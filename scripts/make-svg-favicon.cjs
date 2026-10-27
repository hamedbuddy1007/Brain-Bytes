const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, '..', 'public', 'android-chrome-512x512.png');
const imgBase64 = fs.readFileSync(imgPath).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" href="data:image/png;base64,${imgBase64}" />
</svg>
`;

const outPath = path.join(__dirname, '..', 'public', 'favicon.svg');
fs.writeFileSync(outPath, svg, 'utf8');
console.log('Successfully generated public/favicon.svg');
