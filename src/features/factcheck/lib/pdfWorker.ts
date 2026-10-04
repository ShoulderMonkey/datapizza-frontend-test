import { pdfjs } from 'react-pdf';

// Worker bundled by Next from node_modules and served from the same origin
// (no CDN request). Importing this module has the side effect of configuring pdf.js.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
