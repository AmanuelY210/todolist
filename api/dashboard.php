<?php
require_once 'config.php';
requireLogin();

$user_id = $_SESSION['user_id'];

$stats = [];

$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM tasks WHERE user_id = ?");
$stmt->execute([$user_id]);
$stats['total_tasks'] = (int)$stmt->fetch()['total'];

$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM tasks WHERE user_id = ? AND status = 'completed'");
$stmt->execute([$user_id]);
$stats['completed_tasks'] = (int)$stmt->fetch()['total'];

$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM tasks WHERE user_id = ? AND status = 'pending'");
$stmt->execute([$user_id]);
$stats['pending_tasks'] = (int)$stmt->fetch()['total'];

$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM tasks WHERE user_id = ? AND status = 'in_progress'");
$stmt->execute([$user_id]);
$stats['in_progress_tasks'] = (int)$stmt->fetch()['total'];

$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM tasks WHERE user_id = ? AND due_date IS NOT NULL AND due_date < CURDATE() AND status != 'completed'");
$stmt->execute([$user_id]);
$stats['overdue_tasks'] = (int)$stmt->fetch()['total'];

$progress = $stats['total_tasks'] > 0 ? round(($stats['completed_tasks'] / $stats['total_tasks']) * 100) : 0;
$stats['progress'] = $progress;

$stmt = $pdo->prepare("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM tasks WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month");
$stmt->execute([$user_id]);
$stats['chart_data'] = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT t.*, c.name as category_name, c.color as category_color FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ? AND t.due_date IS NOT NULL AND t.due_date >= CURDATE() AND t.status != 'completed' ORDER BY t.due_date ASC LIMIT 5");
$stmt->execute([$user_id]);
$stats['upcoming_tasks'] = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT c.name, COUNT(t.id) as count FROM categories c LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ? WHERE c.user_id = ? GROUP BY c.id, c.name");
$stmt->execute([$user_id, $user_id]);
$stats['category_distribution'] = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10");
$stmt->execute([$user_id]);
$stats['recent_activity'] = $stmt->fetchAll();

jsonOut(['success' => true, 'stats' => $stats]);

