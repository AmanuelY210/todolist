<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        handleRegister();
        break;
    case 'login':
        handleLogin();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
        checkSession();
        break;
    default:
        jsonOut(['error' => 'Action not found'], 404);
}

function handleRegister() {
    global $pdo;
    $data = json_decode(file_get_contents('php://input'), true);

    $full_name = sanitize($data['full_name'] ?? '');
    $username = sanitize($data['username'] ?? '');
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $confirm_password = $data['confirm_password'] ?? '';

    if (empty($full_name) || empty($username) || empty($email) || empty($password)) {
        jsonOut(['error' => 'All fields are required'], 400);
    }

    if ($password !== $confirm_password) {
        jsonOut(['error' => 'Passwords do not match'], 400);
    }

    if (strlen($password) < 6) {
        jsonOut(['error' => 'Password must be at least 6 characters'], 400);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonOut(['error' => 'Username already exists'], 409);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonOut(['error' => 'Email already exists'], 409);
    }

    $hashed = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (full_name, username, email, password) VALUES (?, ?, ?, ?)");
    $stmt->execute([$full_name, $username, $email, $hashed]);
    $user_id = $pdo->lastInsertId();

    $stmt = $pdo->prepare("INSERT INTO user_settings (user_id) VALUES (?)");
    $stmt->execute([$user_id]);

    $default_categories = [
        ['Work', '#0d6efd'],
        ['Personal', '#198754'],
        ['Study', '#ffc107'],
        ['Shopping', '#dc3545'],
        ['Health', '#0dcaf0']
    ];
    $stmt = $pdo->prepare("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)");
    foreach ($default_categories as $cat) {
        $stmt->execute([$user_id, $cat[0], $cat[1]]);
    }

    logActivity($pdo, $user_id, 'register', 'User registered');

    jsonOut(['success' => true, 'message' => 'Registration successful']);
}

function handleLogin() {
    global $pdo;
    $data = json_decode(file_get_contents('php://input'), true);

    $login = sanitize($data['login'] ?? '');
    $password = $data['password'] ?? '';
    $remember = $data['remember'] ?? false;

    if (empty($login) || empty($password)) {
        jsonOut(['error' => 'All fields are required'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonOut(['error' => 'Invalid credentials'], 401);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];

    if ($remember) {
        $token = bin2hex(random_bytes(32));
        setcookie('remember_token', $token, time() + 86400 * 30, '/', '', false, true);
    }

    logActivity($pdo, $user['id'], 'login', 'User logged in');

    jsonOut([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['id'],
            'full_name' => $user['full_name'],
            'username' => $user['username'],
            'email' => $user['email'],
            'profile_pic' => $user['profile_pic']
        ]
    ]);
}

function handleLogout() {
    session_destroy();
    setcookie('remember_token', '', time() - 3600, '/');
    jsonOut(['success' => true, 'message' => 'Logged out successfully']);
}

function checkSession() {
    if (isLoggedIn()) {
        global $pdo;
        $stmt = $pdo->prepare("SELECT id, full_name, username, email, profile_pic FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if ($user) {
            jsonOut(['logged_in' => true, 'user' => $user]);
            return;
        }
    }
    jsonOut(['logged_in' => false]);
}

