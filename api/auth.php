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
        http_response_code(404);
        echo json_encode(['error' => 'Action not found']);
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
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required']);
        return;
    }

    if ($password !== $confirm_password) {
        http_response_code(400);
        echo json_encode(['error' => 'Passwords do not match']);
        return;
    }

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 6 characters']);
        return;
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Username already exists']);
        return;
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already exists']);
        return;
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

    echo json_encode(['success' => true, 'message' => 'Registration successful']);
}

function handleLogin() {
    global $pdo;
    $data = json_decode(file_get_contents('php://input'), true);

    $login = sanitize($data['login'] ?? '');
    $password = $data['password'] ?? '';
    $remember = $data['remember'] ?? false;

    if (empty($login) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required']);
        return;
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];

    if ($remember) {
        $token = bin2hex(random_bytes(32));
        setcookie('remember_token', $token, time() + 86400 * 30, '/', '', false, true);
    }

    logActivity($pdo, $user['id'], 'login', 'User logged in');

    echo json_encode([
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
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
}

function checkSession() {
    if (isLoggedIn()) {
        global $pdo;
        $stmt = $pdo->prepare("SELECT id, full_name, username, email, profile_pic FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if ($user) {
            echo json_encode(['logged_in' => true, 'user' => $user]);
            return;
        }
    }
    echo json_encode(['logged_in' => false]);
}
