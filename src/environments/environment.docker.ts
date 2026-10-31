// Image Docker locale (`npm run build:docker`, raf-deploy) : la PWA est servie par
// nginx, qui relaie /api au backend. Vide = meme origine.
export const environment = {
  production: true,
  apiUrl: '',
};
