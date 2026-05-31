<?php
header('Content-Type: text/plain');

// Test all API responses
$base = 'http://localhost:3090';

function testEndpoint($url, $method = 'GET', $data = null) {
    $ctx = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n",
            'ignore_errors' => true,
            'content' => $data ? json_encode($data) : null
        ]
    ]);
    $response = @file_get_contents($url, false, $ctx);
    if ($response === false) {
        return ['error' => 'Failed to fetch', 'raw' => ''];
    }
    $json = json_decode($response, true);
    if ($json === null && $response !== '') {
        return ['error' => 'Not JSON', 'raw' => substr($response, 0, 500)];
    }
    return $json ?: ['error' => 'Empty response', 'raw' => $response];
}

echo "=== TESTING TASKFLOW API ===\n\n";

echo "1. CONFIG:\n";
print_r(testEndpoint("$base/api/config.php"));

echo "\n2. REGISTER (empty fields):\n";
$r = testEndpoint("$base/api/auth.php?action=register", 'POST', ['full_name'=>'','username'=>'','email'=>'','password'=>'']);
echo json_encode($r, JSON_PRETTY_PRINT) . "\n";

echo "\n3. REGISTER (valid):\n";
$r = testEndpoint("$base/api/auth.php?action=register", 'POST', [
    'full_name' => 'Test User',
    'username' => 'testuser_' . time(),
    'email' => 'test_' . time() . '@example.com',
    'password' => 'Test123!',
    'confirm_password' => 'Test123!'
]);
echo json_encode($r, JSON_PRETTY_PRINT) . "\n";

echo "\n4. LOGIN:\n";
$r = testEndpoint("$base/api/auth.php?action=login", 'POST', ['login'=>'testuser','password'=>'Test123!']);
echo json_encode($r, JSON_PRETTY_PRINT) . "\n";

echo "\n5. SESSION CHECK:\n";
$r = testEndpoint("$base/api/auth.php?action=check");
echo json_encode($r, JSON_PRETTY_PRINT) . "\n";

echo "\n=== DONE ===\n";
