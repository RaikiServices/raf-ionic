import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards';

/*
 * Les chemins /quiz/:id, /quiz/:id/classement, /portefeuille, /portefeuille/retraits,
 * /verification-email et /nouveau-mot-de-passe sont ceux des liens envoyes par le
 * backend (emails, notifications push) : ne pas les renommer sans lui.
 *
 * Les pages hors onglets sont declarees avant la coquille a onglets, sans quoi
 * /portefeuille/retraits serait capture par l'onglet /portefeuille.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accueil' },

  // --- Sans compte -------------------------------------------------------------
  {
    path: 'bienvenue',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'connexion',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'inscription',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'mot-de-passe-oublie',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'nouveau-mot-de-passe',
    loadComponent: () => import('./pages/auth/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'verification-email',
    loadComponent: () => import('./pages/auth/verify-email.page').then((m) => m.VerifyEmailPage),
  },

  // --- Jeu (hors onglets) --------------------------------------------------------
  {
    path: 'quiz/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/quiz/quiz-detail.page').then((m) => m.QuizDetailPage),
  },
  {
    path: 'quiz/:id/jouer',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/game/game.page').then((m) => m.GamePage),
  },
  {
    path: 'quiz/:id/classement',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/quiz/leaderboard.page').then((m) => m.LeaderboardPage),
  },
  {
    path: 'quiz/:id/corrige/:sessionId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/game/review.page').then((m) => m.ReviewPage),
  },
  {
    path: 'portefeuille/recharger',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wallet/top-up.page').then((m) => m.TopUpPage),
  },
  {
    path: 'portefeuille/retirer',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wallet/withdraw.page').then((m) => m.WithdrawPage),
  },
  {
    path: 'portefeuille/retraits',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wallet/withdrawals.page').then((m) => m.WithdrawalsPage),
  },
  {
    path: 'profil/telephone',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/verify-phone.page').then((m) => m.VerifyPhonePage),
  },
  {
    path: 'profil/mot-de-passe',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/change-password.page').then((m) => m.ChangePasswordPage),
  },
  {
    path: 'profil/telephone/corriger',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/change-phone.page').then((m) => m.ChangePhonePage),
  },
  {
    path: 'profil/email',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/change-email.page').then((m) => m.ChangeEmailPage),
  },
  {
    path: 'profil/supprimer',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/delete-account.page').then((m) => m.DeleteAccountPage),
  },
  {
    path: 'profil/appareils',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/devices.page').then((m) => m.DevicesPage),
  },
  {
    path: 'alertes/reglages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/notifications/notification-settings.page').then((m) => m.NotificationSettingsPage),
  },

  // --- Onglets -------------------------------------------------------------------
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: 'accueil', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
      { path: 'solo', loadComponent: () => import('./pages/solo/solo.page').then((m) => m.SoloPage) },
      { path: 'tickets', loadComponent: () => import('./pages/tickets/tickets.page').then((m) => m.TicketsPage) },
      { path: 'portefeuille', loadComponent: () => import('./pages/wallet/wallet.page').then((m) => m.WalletPage) },
      {
        path: 'alertes',
        loadComponent: () => import('./pages/notifications/notifications.page').then((m) => m.NotificationsPage),
      },
      { path: 'profil', loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
    ],
  },

  { path: '**', redirectTo: 'accueil' },
];
