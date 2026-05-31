<?php
require_once 'config.php';
requireLogin();

$user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get':
        getProfile();
        break;
    case 'update':
        updateProfile();
        break;
    case 'password':
        changePassword();
        break;
    case 'upload':
        uploadProfilePic();
        break;
    case 'settings':
        handleSettings();
        break;
    case 'get_settings':
        getSettings();
        break;
    default:
                jsonOut(["error" => "Action not found"], 404);
}

function getProfile() {
    global $pdo, $user_id;
    $stmt = $pdo->prepare("SELECT id, full_name, username, email, profile_pic FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    jsonOut(['success' => true, 'user' => $stmt->fetch()]);
}

function updateProfile() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $full_name = sanitize($data['full_name'] ?? '');
    $email = sanitize($data['email'] ?? '');

    if (empty($full_name) || empty($email)) {
                jsonOut(["error" => "All fields are required"], 400);
        return;
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmt->execute([$email, $user_id]);
    if ($stmt->fetch()) {
                jsonOut(["error" => "Email already in use"], 409);
        return;
    }

    $stmt = $pdo->prepare("UPDATE users SET full_name = ?, email = ? WHERE id = ?");
    $stmt->execute([$full_name, $email, $user_id]);

    logActivity($pdo, $user_id, 'update_profile', 'Updated profile');

    jsonOut(['success' => true, 'message' => 'Profile updated']);
}

function changePassword() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $current = $data['current_password'] ?? '';
    $new = $data['new_password'] ?? '';
    $confirm = $data['confirm_password'] ?? '';

    if (empty($current) || empty($new) || empty($confirm)) {
                jsonOut(["error" => "All fields are required"], 400);
        return;
    }

    if ($new !== $confirm) {
                jsonOut(["error" => "New passwords do not match"], 400);
        return;
    }

    if (strlen($new) < 6) {
                jsonOut(["error" => "Password must be at least 6 characters"], 400);
        return;
    }

    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();

    if (!password_verify($current, $user['password'])) {
                jsonOut(["error" => "Current password is incorrect"], 401);
        return;
    }

    $hashed = password_hash($new, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->execute([$hashed, $user_id]);

    jsonOut(['success' => true, 'message' => 'Password changed']);
}

function uploadProfilePic() {
    global $user_id;
    $upload_dir = __DIR__ . '/../uploads/';
    if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);

    if (!isset($_FILES['profile_pic'])) {
                jsonOut(["error" => "No file uploaded"], 400);
        return;
    }

    $file = $_FILES['profile_pic'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!in_array($ext, $allowed)) {
                jsonOut(["error" => "Invalid file type"], 400);
        return;
    }

    $filename = 'user_' . $user_id . '_' . time() . '.' . $ext;
    move_uploaded_file($file['tmp_name'], $upload_dir . $filename);

    global $pdo;
    $stmt = $pdo->prepare("UPDATE users SET profile_pic = ? WHERE id = ?");
    $stmt->execute([$filename, $user_id]);

    jsonOut(['success' => true, 'message' => 'Profile picture updated', 'filename' => $filename]);
}

function handleSettings() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);

    $stmt = $pdo->prepare("UPDATE user_settings SET dark_mode = ?, notifications = ?, language = ? WHERE user_id = ?");
    $stmt->execute([
        (int)($data['dark_mode'] ?? 0),
        (int)($data['notifications'] ?? 1),
        sanitize($data['language'] ?? 'en'),
        $user_id
    ]);

    jsonOut(['success' => true, 'message' => 'Settings saved']);
}

function getSettings() {
    global $pdo, $user_id;
    $stmt = $pdo->prepare("SELECT * FROM user_settings WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $settings = $stmt->fetch();
    if (!$settings) {
        $stmt = $pdo->prepare("INSERT INTO user_settings (user_id) VALUES (?)");
        $stmt->execute([$user_id]);
        $settings = ['dark_mode' => 0, 'notifications' => 1, 'language' => 'en'];
    }
    jsonOut(['success' => true, 'settings' => $settings]);
}


