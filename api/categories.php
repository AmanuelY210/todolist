<?php
require_once 'config.php';
requireLogin();

$user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        listCategories();
        break;
    case 'create':
        createCategory();
        break;
    case 'update':
        updateCategory();
        break;
    case 'delete':
        deleteCategory();
        break;
    default:
                jsonOut(["error" => "Action not found"], 404);
}

function listCategories() {
    global $pdo, $user_id;
    $stmt = $pdo->prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC");
    $stmt->execute([$user_id]);
    $categories = $stmt->fetchAll();
    jsonOut(['success' => true, 'categories' => $categories]);
}

function createCategory() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $name = sanitize($data['name'] ?? '');
    $color = sanitize($data['color'] ?? '#6c757d');

    if (empty($name)) {
                jsonOut(["error" => "Category name is required"], 400);
        return;
    }

    $stmt = $pdo->prepare("SELECT id FROM categories WHERE user_id = ? AND name = ?");
    $stmt->execute([$user_id, $name]);
    if ($stmt->fetch()) {
                jsonOut(["error" => "Category already exists"], 409);
        return;
    }

    $stmt = $pdo->prepare("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)");
    $stmt->execute([$user_id, $name, $color]);
    $cat_id = $pdo->lastInsertId();

    logActivity($pdo, $user_id, 'create_category', "Created category: $name");

    $stmt = $pdo->prepare("SELECT * FROM categories WHERE id = ?");
    $stmt->execute([$cat_id]);
    jsonOut(['success' => true, 'message' => 'Category created', 'category' => $stmt->fetch()]);
}

function updateCategory() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);
    $name = sanitize($data['name'] ?? '');
    $color = sanitize($data['color'] ?? '#6c757d');

    if (empty($name)) {
                jsonOut(["error" => "Category name is required"], 400);
        return;
    }

    $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);
    if (!$stmt->fetch()) {
                jsonOut(["error" => "Category not found"], 404);
        return;
    }

    $stmt = $pdo->prepare("UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$name, $color, $id, $user_id]);

    logActivity($pdo, $user_id, 'update_category', "Updated category: $name");

    jsonOut(['success' => true, 'message' => 'Category updated']);
}

function deleteCategory() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);
    if (!$stmt->fetch()) {
                jsonOut(["error" => "Category not found"], 404);
        return;
    }

    $stmt = $pdo->prepare("UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);

    $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);

    logActivity($pdo, $user_id, 'delete_category', 'Deleted category');

    jsonOut(['success' => true, 'message' => 'Category deleted']);
}


