// Spustí Expo s automaticky zjištěnou IP adresou počítače (npm run demo).
// Bere síťový adaptér s výchozí bránou, tj. ten, přes který je počítač připojený
// (hotspot telefonu, Wi-Fi školy...), a ignoruje virtuální adaptéry (WSL, Hyper-V, VPN).
const { execSync, spawn } = require('node:child_process');

function zjistiIp() {
  if (process.platform !== 'win32') return null;
  try {
    const prikaz =
      "Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } " +
      '| Select-Object -First 1 -ExpandProperty IPv4Address | Select-Object -ExpandProperty IPAddress';
    const ip = execSync(`powershell -NoProfile -Command "${prikaz}"`, { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null;
  } catch {
    return null;
  }
}

const ip = zjistiIp();
const env = { ...process.env };
if (ip) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log(`\nIP počítače: ${ip}`);
  console.log(`Telefon musí být ve stejné síti. Lokální backend: http://${ip}:8000\n`);
} else {
  console.log('\nIP adresu se nepodařilo zjistit, Expo ji vybere samo.\n');
}

// --offline: Expo Go nevyžaduje přihlášení k účtu Expo
const expo = spawn('npx', ['expo', 'start', '--offline', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: true });
expo.on('exit', (kod) => process.exit(kod ?? 0));
