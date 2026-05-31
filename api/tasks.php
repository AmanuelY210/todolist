<?php
require_once 'config.php';
requireLogin();

$action = $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];

switch ($action) {
    case 'list':
        listTasks();
        break;
    case 'create':
        createTask();
        break;
    case 'get':
        getTask();
        break;
    case 'update':
        updateTask();
        break;
    case 'delete':
        deleteTask();
        break;
    case 'duplicate':
        duplicateTask();
        break;
    case 'reorder':
        reorderTask();
        break;
    default:
                jsonOut(["error" => "Action not found"], 404);
}

function listTasks() {
    global $pdo, $user_id;
    $search = sanitize($_GET['search'] ?? '');
    $category = sanitize($_GET['category'] ?? '');
    $priority = sanitize($_GET['priority'] ?? '');
    $status = sanitize($_GET['status'] ?? '');
    $sort = sanitize($_GET['sort'] ?? 'newest');
    $due_date = sanitize($_GET['due_date'] ?? '');

    $sql = "SELECT t.*, c.name as category_name, c.color as category_color 
            FROM tasks t LEFT JOIN categories c ON t.category_id = c.id 
            WHERE t.user_id = ?";
    $params = [$user_id];

    if (!empty($search)) {
        $sql .= " AND (t.title LIKE ? OR t.description LIKE ? OR c.name LIKE ?)";
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }
    if (!empty($category)) {
        $sql .= " AND t.category_id = ?";
        $params[] = $category;
    }
    if (!empty($priority)) {
        $sql .= " AND t.priority = ?";
        $params[] = $priority;
    }
    if (!empty($status)) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }
    if (!empty($due_date)) {
        $sql .= " AND t.due_date = ?";
        $params[] = $due_date;
    }

    switch ($sort) {
        case 'oldest': $sql .= " ORDER BY t.created_at ASC"; break;
        case 'due_date': $sql .= " ORDER BY t.due_date ASC"; break;
        case 'priority': $sql .= " ORDER BY FIELD(t.priority,'high','medium','low') ASC"; break;
        case 'status': $sql .= " ORDER BY FIELD(t.status,'pending','in_progress','completed') ASC"; break;
        default: $sql .= " ORDER BY t.created_at DESC";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tasks = $stmt->fetchAll();

    jsonOut(['success' => true, 'tasks' => $tasks]);
}

function createTask() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);

    $title = sanitize($data['title'] ?? '');
    $description = sanitize($data['description'] ?? '');
    $category_id = !empty($data['category_id']) ? (int)$data['category_id'] : null;
    $priority = sanitize($data['priority'] ?? 'medium');
    $status = sanitize($data['status'] ?? 'pending');
    $due_date = sanitize($data['due_date'] ?? '');
    $notes = sanitize($data['notes'] ?? '');

    if (empty($title)) {
                jsonOut(["error" => "Title is required"], 400);
        return;
    }

    if (!in_array($priority, ['low', 'medium', 'high'])) $priority = 'medium';
    if (!in_array($status, ['pending', 'in_progress', 'completed'])) $status = 'pending';
    if (empty($due_date)) $due_date = null;

    $stmt = $pdo->prepare("INSERT INTO tasks (user_id, category_id, title, description, priority, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$user_id, $category_id, $title, $description, $priority, $status, $due_date, $notes]);
    $task_id = $pdo->lastInsertId();

    logActivity($pdo, $user_id, 'create_task', "Created task: $title");

    $stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?");
    $stmt->execute([$task_id]);
    $task = $stmt->fetch();

    jsonOut(['success' => true, 'message' => 'Task created', 'task' => $task]);
}

function getTask() {
    global $pdo, $user_id;
    $id = (int)($_GET['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ? AND t.user_id = ?");
    $stmt->execute([$id, $user_id]);
    $task = $stmt->fetch();

    if (!$task) {
                jsonOut(["error" => "Task not found"], 404);
        return;
    }

    jsonOut(['success' => true, 'task' => $task]);
}

function updateTask() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT id FROM tasks WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);
    if (!$stmt->fetch()) {
                jsonOut(["error" => "Task not found"], 404);
        return;
    }

    $title = sanitize($data['title'] ?? '');
    $description = sanitize($data['description'] ?? '');
    $category_id = !empty($data['category_id']) ? (int)$data['category_id'] : null;
    $priority = sanitize($data['priority'] ?? 'medium');
    $status = sanitize($data['status'] ?? 'pending');
    $due_date = sanitize($data['due_date'] ?? '');
    $notes = sanitize($data['notes'] ?? '');

    if (empty($title)) {
                jsonOut(["error" => "Title is required"], 400);
        return;
    }

    if (!in_array($priority, ['low', 'medium', 'high'])) $priority = 'medium';
    if (!in_array($status, ['pending', 'in_progress', 'completed'])) $status = 'pending';
    if (empty($due_date)) $due_date = null;

    $stmt = $pdo->prepare("UPDATE tasks SET title=?, description=?, category_id=?, priority=?, status=?, due_date=?, notes=? WHERE id=? AND user_id=?");
    $stmt->execute([$title, $description, $category_id, $priority, $status, $due_date, $notes, $id, $user_id]);

    logActivity($pdo, $user_id, 'update_task', "Updated task: $title");

    $stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?");
    $stmt->execute([$id]);
    $task = $stmt->fetch();

    jsonOut(['success' => true, 'message' => 'Task updated', 'task' => $task]);
}

function deleteTask() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT title FROM tasks WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);
    $task = $stmt->fetch();

    if (!$task) {
                jsonOut(["error" => "Task not found"], 404);
        return;
    }

    $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);

    logActivity($pdo, $user_id, 'delete_task', "Deleted task: {$task['title']}");

    jsonOut(['success' => true, 'message' => 'Task deleted']);
}

function duplicateTask() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $user_id]);
    $task = $stmt->fetch();

    if (!$task) {
                jsonOut(["error" => "Task not found"], 404);
        return;
    }

    $stmt = $pdo->prepare("INSERT INTO tasks (user_id, category_id, title, description, priority, status, due_date, notes) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)");
    $stmt->execute([$user_id, $task['category_id'], $task['title'] . ' (Copy)', $task['description'], $task['priority'], $task['due_date'], $task['notes']]);
    $new_id = $pdo->lastInsertId();

    logActivity($pdo, $user_id, 'duplicate_task', "Duplicated task: {$task['title']}");

    $stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?");
    $stmt->execute([$new_id]);
    $new_task = $stmt->fetch();

    jsonOut(['success' => true, 'message' => 'Task duplicated', 'task' => $new_task]);
}

function reorderTask() {
    global $pdo, $user_id;
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);
    $new_status = sanitize($data['status'] ?? '');

    if (!in_array($new_status, ['pending', 'in_progress', 'completed'])) {
                jsonOut(["error" => "Invalid status"], 400);
        return;
    }

    $stmt = $pdo->prepare("UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$new_status, $id, $user_id]);

    jsonOut(['success' => true, 'message' => 'Task moved']);
}


