import { Component, OnInit } from '@angular/core';
import { MdDialog, MdDialogRef, MdIconRegistry, MdSnackBar } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuth, AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFireDatabase } from 'angularfire2/database';
import * as firebase from 'firebase/app';

import { FeedbackDialogComponent } from './feedback-dialog/feedback-dialog.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'PartWays';
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  currentApplicationId: string;
  isLoading = true;

  constructor(private afAuth: AngularFireAuth, public db: AngularFireDatabase, private router: Router, iconRegistry: MdIconRegistry, public dialog: MdDialog, sanitizer: DomSanitizer) {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUserName');
    this.currentUserId = null;
    // ToDo do we need this?
    iconRegistry.addSvgIcon('A', sanitizer.bypassSecurityTrustResourceUrl('assets/img/a.svg'));

    router.events.subscribe((event: RouterEvent) => {
      this.navigationInterceptor(event);
    });

    this.afAuth.authState.subscribe((auth) => {
      if (!auth) {
        return;
      }
      this.router.navigate([(localStorage.getItem('redirect') ? localStorage.getItem('redirect') : '/')]);
      this.currentUserId = auth.uid;
      this.currentUserName = auth.displayName;
      this.currentUserEmail = auth.email;
      const user = this.db.object(`/user/${this.currentUserId}`);
      user.subscribe((item) => {
        if (item.$exists()) {
          this.currentApplicationId = item.applicationId;
          localStorage.setItem('applicationId', item.applicationId);
        } else {
          this.createNewUserAndApplication();
        }
      });

      localStorage.setItem('currentUserId', this.currentUserId);
      localStorage.setItem('currentUserName', auth.displayName);
    });
  }

  ngOnInit() {
    return this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.title = this.getDeepestTitle(this.router.routerState.snapshot.root);
      }
    });
  }

  /**
   * Shows and hides the loading spinner during RouterEvent changes
   *
   * @param {RouterEvent} event
   * @memberOf AppComponent
   */
  navigationInterceptor(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      this.isLoading = true;
    }
    if (event instanceof NavigationEnd) {
      this.isLoading = false;
    }
    if (event instanceof NavigationCancel) {
      this.isLoading = false;
    }
    if (event instanceof NavigationError) {
      this.isLoading = false;
    }
  }

  loginGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    this.afAuth.auth.signInWithPopup(provider);
  }

  loginFacebook() {
    const provider = new firebase.auth.FacebookAuthProvider();
    this.afAuth.auth.signInWithPopup(provider);
  }

  logout() {
    this.afAuth.auth.signOut();
    this.currentUserId = null;
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('redirect');
    this.router.navigate(['/']);
  }

  private createNewUserAndApplication() {
    const newApplication = {
      parties: {
        applicant: {
          id: this.currentUserId,
          name: this.currentUserName,
        },
      },
    };
    const newApplicationRef = this.db.list(`/application`);
    newApplicationRef.push(newApplication).then((application) => {
      this.currentApplicationId = application.key;
      const userData = {
        authName: this.currentUserName,
        authEmail: this.currentUserEmail,
        applicationId: this.currentApplicationId,
      };
      const newUser = this.db.object(`/user/${this.currentUserId}`);
      newUser.set(userData);
    });
  }

  private getDeepestTitle(routeSnapshot: ActivatedRouteSnapshot) {
    let title = routeSnapshot.data ? routeSnapshot.data['title'] : '';
    if (routeSnapshot.firstChild) {
      title = this.getDeepestTitle(routeSnapshot.firstChild) || title;
    }
    return title;
  }

  openPrintForm() {
    window.open('/assets/printform/index.html', '_blank');
  }

  openFeedbackDialog() {
    const feedbackDialog = this.dialog.open(FeedbackDialogComponent);
    feedbackDialog.afterClosed().subscribe((feedback) => {
      feedback.userId = this.currentUserId;
      feedback.applicationId = this.currentApplicationId;
      feedback.url = this.router.routerState.snapshot.url;
      feedback.userName = this.currentUserName;
      feedback.email = this.currentUserEmail;
      feedback.submittedAt = firebase.database.ServerValue.TIMESTAMP;

      const feedbackRef = this.db.list(`/feedback`);
      feedbackRef.push(feedback);
    });
  }

}
