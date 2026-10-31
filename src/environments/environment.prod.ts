// Production. La PWA est servie par GitHub Pages (app.rafhaiti.com, `npm run deploy`)
// et appelle l'API sur son propre domaine : l'origine https://app.rafhaiti.com doit
// figurer dans CORS_ALLOWED_ORIGINS.
// L'image Docker locale utilise environment.docker.ts (`npm run build:docker`).
export const environment = {
  production: true,
  apiUrl: 'https://api.rafhaiti.com',
};
