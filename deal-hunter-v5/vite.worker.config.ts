import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'dist/server',emptyOutDir:true,target:'es2022',lib:{entry:'worker/index.ts',formats:['es'],fileName:()=> 'index.js'},minify:false}});
