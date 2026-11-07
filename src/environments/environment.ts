// Developpement : backend local (./mvnw spring-boot:run, port 8081).
// Sur un telephone ou l'emulateur Android, localhost designe l'appareil lui-meme :
// remplacez par l'adresse du PC sur le reseau (ex. http://192.168.1.20:8081),
// ou 10.0.2.2 pour l'emulateur, et ajoutez l'origine a CORS_ALLOWED_ORIGINS.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081',
  /** Site vitrine (raf-frontend-ssr), pour le guide d'aide /aide. */
  siteUrl: 'http://localhost:4200',
};
