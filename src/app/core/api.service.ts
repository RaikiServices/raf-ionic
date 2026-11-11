import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { api } from './api-url';
import {
  AppConfig,
  AppNotification,
  Category,
  DepositNumbers,
  DeviceSession,
  GameAnswer,
  GameMode,
  GameOutcome,
  GameResult,
  GameStart,
  GameTurn,
  Invite,
  LeaderTransfer,
  LeaderTransferConfig,
  LeaderTransferPlayer,
  Leaderboard,
  MessageResponse,
  NewsItem,
  NotificationPreference,
  Page,
  PlayerStats,
  Quiz,
  Ticket,
  OnlineTopUpConfig,
  PayoutConfig,
  TopUp,
  TopUpAvailability,
  Transaction,
  User,
  Wallet,
  Withdrawal,
  WithdrawalRequest,
  WinningsConversion,
  PayoutTerms,
} from './models';

function paging(page: number, size: number): HttpParams {
  return new HttpParams().set('page', page).set('size', size);
}

/** Endpoints de l'API utilises par l'application joueur. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // --- Compte -----------------------------------------------------------------

  me(): Observable<User> {
    return this.http.get<User>(api('/me'));
  }

  /** Statistiques personnelles (onglet Actualite). */
  myStats(): Observable<PlayerStats> {
    return this.http.get<PlayerStats>(api('/me/stats'));
  }

  /** Actualites publiees, epinglees d'abord. */
  news(page = 0, size = 10): Observable<Page<NewsItem>> {
    return this.http.get<Page<NewsItem>>(api('/news'), { params: paging(page, size) });
  }

  /** Lien d'inscription a partager, avec ce joueur pour parrain. */
  invite(): Observable<Invite> {
    return this.http.get<Invite>(api('/me/invite'));
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/password/forgot'), { email: email.trim() });
  }

  resetPassword(token: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/password/reset'), { token, newPassword });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/password/change'), { currentPassword, newPassword });
  }

  /** Corrige le numero, tant qu'il n'est pas verifie. */
  correctPhone(password: string, phone: string): Observable<User> {
    return this.http.post<User>(api('/me/phone'), { password, phone });
  }

  /** Corrige l'email, tant qu'il n'est pas verifie : un nouveau lien part a la nouvelle adresse. */
  correctEmail(password: string, email: string): Observable<User> {
    return this.http.post<User>(api('/me/email'), { password, email });
  }

  /** Supprime (anonymise) le compte. forfeitBalance : le joueur renonce a son solde. */
  deleteAccount(password: string, forfeitBalance: boolean): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/me/delete'), { password, forfeitBalance });
  }

  verifyEmail(token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/email/verify'), { token });
  }

  /** Confirme l'email avec le code a 6 chiffres recu dans le meme email que le lien. */
  verifyEmailCode(code: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/email/verify-code'), { code });
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/email/resend'), { email });
  }

  sendPhoneOtp(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/phone/send-otp'), {});
  }

  verifyPhone(code: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/auth/phone/verify'), { code });
  }

  sessions(): Observable<DeviceSession[]> {
    return this.http.get<DeviceSession[]>(api('/me/sessions'));
  }

  revokeSession(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(api(`/me/sessions/${id}`));
  }

  revokeAllSessions(): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(api('/me/sessions'));
  }

  // --- Quiz et tickets ---------------------------------------------------------

  quizzes(page = 0, size = 30, mode: GameMode = 'GROUP'): Observable<Page<Quiz>> {
    return this.http.get<Page<Quiz>>(api('/quizzes'), { params: paging(page, size).set('mode', mode) });
  }

  /** Categories actives, tous modes confondus : un parent peut ne servir a aucun quiz. */
  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(api('/categories'));
  }

  quiz(id: number): Observable<Quiz> {
    return this.http.get<Quiz>(api(`/quizzes/${id}`));
  }

  buyTicket(quizId: number, idempotencyKey: string): Observable<Ticket> {
    return this.http.post<Ticket>(api(`/quizzes/${quizId}/tickets`), { idempotencyKey });
  }

  quizTickets(quizId: number): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(api(`/quizzes/${quizId}/tickets`));
  }

  myTickets(page = 0, size = 100): Observable<Page<Ticket>> {
    return this.http.get<Page<Ticket>>(api('/tickets'), { params: paging(page, size) });
  }

  vote(quizId: number, topicId: number): Observable<Quiz> {
    return this.http.post<Quiz>(api(`/quizzes/${quizId}/vote/${topicId}`), {});
  }

  leaderboard(quizId: number, page = 0, size = 50): Observable<Leaderboard> {
    return this.http.get<Leaderboard>(api(`/quizzes/${quizId}/leaderboard`), { params: paging(page, size) });
  }

  // --- Parties -----------------------------------------------------------------

  startGame(quizId: number): Observable<GameStart> {
    return this.http.post<GameStart>(api('/game/start'), { quizId });
  }

  submitGame(sessionId: number, answers: GameAnswer[], clientDurationMs: number): Observable<GameResult> {
    return this.http.post<GameResult>(api('/game/submit'), { sessionId, answers, clientDurationMs });
  }

  /** SEQUENTIAL : repond a la question en cours (choiceId null : passer) et recoit la suivante. */
  answerQuestion(sessionId: number, questionId: number, choiceId: number | null): Observable<GameTurn> {
    return this.http.post<GameTurn>(api(`/game/${sessionId}/answer`), { questionId, choiceId });
  }

  // --- Recharge de ses joueurs par un leader ---------------------------------------

  leaderTransferConfig(): Observable<LeaderTransferConfig> {
    return this.http.get<LeaderTransferConfig>(api('/leader/transfers/config'));
  }

  /** Joueurs rattaches au leader ; recherche par nom ou chiffres du telephone. */
  leaderTransferPlayers(query: string, page = 0, size = 20): Observable<Page<LeaderTransferPlayer>> {
    let params = paging(page, size);
    if (query.trim()) {
      params = params.set('q', query.trim());
    }
    return this.http.get<Page<LeaderTransferPlayer>>(api('/leader/transfers/players'), { params });
  }

  leaderTransfers(page = 0, size = 10): Observable<Page<LeaderTransfer>> {
    return this.http.get<Page<LeaderTransfer>>(api('/leader/transfers'), { params: paging(page, size) });
  }

  /** Irreversible. Meme requestKey = meme recharge : un double envoi n'est applique qu'une fois. */
  leaderTransfer(playerId: number, credits: number, requestKey: string): Observable<LeaderTransfer> {
    return this.http.post<LeaderTransfer>(api('/leader/transfers'), { playerId, credits, requestKey });
  }

  /** Sujets deja joues en solo aujourd'hui : une partie par sujet et par jour. */
  soloPlayedToday(): Observable<number[]> {
    return this.http.get<number[]>(api('/game/solo/played-today'));
  }

  /** Premiere partie solo offerte : la prochaine partie payante du joueur l'est-elle ? */
  firstSoloOffer(): Observable<{ offered: boolean }> {
    return this.http.get<{ offered: boolean }>(api('/game/solo/first-game-offer'));
  }

  /** Accord du paiement des retraits par tranches : a accepter avant le solo ? */
  payoutTerms(): Observable<PayoutTerms> {
    return this.http.get<PayoutTerms>(api('/game/solo/payout-terms'));
  }

  acceptPayoutTerms(version: number): Observable<PayoutTerms> {
    return this.http.post<PayoutTerms>(api('/game/solo/payout-terms'), { version });
  }

  mySessions(quizId: number): Observable<GameResult[]> {
    return this.http.get<GameResult[]>(api('/game/sessions'), { params: { quizId } });
  }

  review(sessionId: number): Observable<GameOutcome> {
    return this.http.get<GameOutcome>(api(`/game/${sessionId}/review`));
  }

  // --- Portefeuille ------------------------------------------------------------

  wallet(): Observable<Wallet> {
    return this.http.get<Wallet>(api('/wallet'));
  }

  transactions(page = 0, size = 20): Observable<Page<Transaction>> {
    return this.http.get<Page<Transaction>>(api('/wallet/transactions'), { params: paging(page, size) });
  }

  topUps(page = 0, size = 20): Observable<Page<TopUp>> {
    return this.http.get<Page<TopUp>>(api('/wallet/topups'), { params: paging(page, size) });
  }

  /** Retraits MonCash / NatCash : envoi automatique actif et frais (lu sans connexion). */
  payoutConfig(): Observable<PayoutConfig> {
    return this.http.get<PayoutConfig>(api('/public/payouts'));
  }

  /** Une recharge ; une recharge en ligne en attente est reverifiee aupres de la passerelle. */
  topUp(id: number): Observable<TopUp> {
    return this.http.get<TopUp>(api(`/wallet/topups/${id}`));
  }

  /** Recharge en ligne MonCash / NatCash : disponibilite, frais et bornes (lu sans connexion). */
  onlineTopUpConfig(): Observable<OnlineTopUpConfig> {
    return this.http.get<OnlineTopUpConfig>(api('/public/online-topup'));
  }

  /** Lance une recharge en ligne ; le joueur paie ensuite sur `paymentUrl`. Frais en plus du montant. */
  startOnlineTopUp(amountHtg: number, provider: 'MONCASH' | 'NATCASH'): Observable<TopUp> {
    return this.http.post<TopUp>(api('/wallet/topups/online'), { amountHtg, provider });
  }

  /** Comportements de l'app choisis dans le back-office (lu sans connexion). */
  appConfig(): Observable<AppConfig> {
    return this.http.get<AppConfig>(api('/public/app-config'));
  }

  /** Recharge avec les gains : seules les gourdes formant des credits entiers sont debitees. */
  convertWinnings(amountHtg: number, requestKey: string): Observable<WinningsConversion> {
    return this.http.post<WinningsConversion>(api('/wallet/conversions'), { amountHtg, requestKey });
  }

  depositNumbers(): Observable<DepositNumbers> {
    return this.http.get<DepositNumbers>(api('/public/deposit-numbers'));
  }

  topUpAvailability(): Observable<TopUpAvailability> {
    return this.http.get<TopUpAvailability>(api('/public/topup-availability'));
  }

  sendWithdrawalOtp(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/wallet/withdrawals/send-otp'), {});
  }

  requestWithdrawal(request: WithdrawalRequest): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(api('/wallet/withdrawals'), request);
  }

  withdrawals(page = 0, size = 20): Observable<Page<Withdrawal>> {
    return this.http.get<Page<Withdrawal>>(api('/wallet/withdrawals'), { params: paging(page, size) });
  }

  // --- Notifications -----------------------------------------------------------

  notifications(page = 0, size = 20): Observable<Page<AppNotification>> {
    return this.http.get<Page<AppNotification>>(api('/notifications'), { params: paging(page, size) });
  }

  unreadCount(): Observable<{ unread: number }> {
    return this.http.get<{ unread: number }>(api('/notifications/unread-count'));
  }

  markRead(id: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api(`/notifications/${id}/read`), {});
  }

  /** Messages de l'equipe a afficher en popup, du plus ancien au plus recent. */
  popups(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(api('/notifications/popups'));
  }

  /** « J'ai compris » : le popup ne s'affichera plus. */
  acknowledge(id: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api(`/notifications/${id}/ack`), {});
  }

  markAllRead(): Observable<{ marked: number }> {
    return this.http.post<{ marked: number }>(api('/notifications/read-all'), {});
  }

  preferences(): Observable<NotificationPreference[]> {
    return this.http.get<NotificationPreference[]>(api('/notifications/preferences'));
  }

  updatePreferences(
    updates: { type: string; channel: string; enabled: boolean }[],
  ): Observable<NotificationPreference[]> {
    return this.http.put<NotificationPreference[]>(api('/notifications/preferences'), updates);
  }

  pushPublicKey(): Observable<{ configured: boolean; publicKey?: string }> {
    return this.http.get<{ configured: boolean; publicKey?: string }>(api('/notifications/push/public-key'));
  }

  subscribePush(subscription: PushSubscriptionJSON): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(api('/notifications/push/subscriptions'), {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });
  }

  unsubscribePush(endpoint: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(api('/notifications/push/subscriptions'), { params: { endpoint } });
  }
}
