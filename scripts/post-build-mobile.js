import fs from 'fs';
import path from 'path';

const distMobile = path.resolve('dist/mobile');
const oldFile = path.join(distMobile, 'capacitor.html');
const newFile = path.join(distMobile, 'index.html');

if (fs.existsSync(oldFile)) {
  fs.renameSync(oldFile, newFile);
  console.log('✅ Renamed capacitor.html → index.html');
} else {
  console.log('⚠️ capacitor.html not found, skipping rename');
}

// Fix absolute paths to relative for Capacitor file:// serving
if (fs.existsSync(newFile)) {
  let html = fs.readFileSync(newFile, 'utf-8');
  // Replace "/assets/" with "assets/" (relative)
  html = html.replace(/src="\/assets\//g, 'src="assets/');
  html = html.replace(/href="\/assets\//g, 'href="assets/');
  fs.writeFileSync(newFile, html);
  console.log('✅ Fixed asset paths to relative');
}
