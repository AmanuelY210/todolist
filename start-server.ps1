Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TaskFlow - Modern To-Do List App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if MySQL is available
$mysqlCheck = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
if (-not $mysqlCheck) {
    Write-Host "[!] MySQL service not found. Please ensure MySQL is running." -ForegroundColor Yellow
} else {
    Write-Host "[+] MySQL service detected." -ForegroundColor Green
}

# Check PHP
$phpVersion = php -v 2>$null
if (-not $phpVersion) {
    Write-Host "[!] PHP is not installed or not in PATH." -ForegroundColor Red
    Write-Host "    Install PHP and ensure it's in your PATH." -ForegroundColor Red
    exit 1
}
Write-Host "[+] PHP detected." -ForegroundColor Green

# Run database setup
Write-Host ""
Write-Host "[*] Setting up database..." -ForegroundColor Yellow
php -r "
    try {
        `$pdo = new PDO('mysql:host=localhost;charset=utf8mb4', 'root', '');
        `$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        `$pdo->exec('CREATE DATABASE IF NOT EXISTS todo_list');
        `$pdo->exec('USE todo_list');
        `$sql = file_get_contents('install.sql');
        `$statements = array_filter(array_map('trim', explode(';', `$sql)));
        foreach (`$statements as `$stmt) {
            if (stripos(`$stmt, 'CREATE DATABASE') === false && stripos(`$stmt, 'USE ') === false) {
                try { `$pdo->exec(`$stmt); } catch (Exception `$e) { echo \"  Warning: \" . `$e->getMessage() . \"`n\"; }
            }
        }
        echo \"[+] Database setup complete.`n\";
    } catch (Exception `$e) {
        echo \"[!] Database setup failed: \" . `$e->getMessage() . \"`n\";
        echo \"    Run install.sql manually in MySQL.`n\";
    }
"

Write-Host ""
Write-Host "[*] Starting PHP development server..." -ForegroundColor Yellow
Write-Host "    URL: http://localhost:3090" -ForegroundColor Green
Write-Host "    Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

php -S localhost:3090
