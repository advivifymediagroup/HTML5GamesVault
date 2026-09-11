<?php
/**
 * GitHub webhook receiver: verifies the push signature, then runs
 * `git pull` in this directory so the live site matches origin/main.
 *
 * Setup (see deploy-secret.example.php for details):
 *   1. Copy deploy-secret.example.php to deploy-secret.php on the server
 *      and set a long random DEPLOY_SECRET value. deploy-secret.php is
 *      gitignored — it must be created once directly on the server and
 *      is never pulled or overwritten.
 *   2. In GitHub: Settings -> Webhooks -> Add webhook
 *        Payload URL: https://yourdomain.com/deploy.php
 *        Content type: application/json
 *        Secret: the same value as DEPLOY_SECRET
 *        Events: just the push event
 */

http_response_code(404);

$secretFile = __DIR__ . '/deploy-secret.php';
if (!file_exists($secretFile)) {
    exit('Not configured.');
}
require $secretFile;

if (!defined('DEPLOY_SECRET') || DEPLOY_SECRET === '') {
    exit('Not configured.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit;
}

$payload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

$expected = 'sha256=' . hash_hmac('sha256', $payload, DEPLOY_SECRET);
if (!hash_equals($expected, $signatureHeader)) {
    http_response_code(403);
    exit('Invalid signature.');
}

$data = json_decode($payload, true);
$ref = $data['ref'] ?? '';
if ($ref !== 'refs/heads/main') {
    http_response_code(200);
    exit("Ignored ref: $ref");
}

if (!function_exists('shell_exec')) {
    http_response_code(500);
    exit('shell_exec is disabled on this server; use the cron-based deploy instead.');
}

putenv('GIT_TERMINAL_PROMPT=0');
$output = shell_exec('cd ' . escapeshellarg(__DIR__) . ' && git pull origin main 2>&1');

$logLine = '[' . date('Y-m-d H:i:s') . "] deploy triggered\n" . $output . "\n---\n";
file_put_contents(__DIR__ . '/deploy.log', $logLine, FILE_APPEND);

http_response_code(200);
echo "OK\n";
