<?php
/**
 * Copy this file to deploy-secret.php ON THE SERVER ONLY (via SSH/SFTP,
 * not through git) and fill in a long random value. Use the exact same
 * value as the "Secret" field on the GitHub webhook.
 *
 * deploy-secret.php is listed in .gitignore so it will never be
 * committed, pulled, or overwritten by a deploy.
 *
 * Generate a random secret, e.g.:
 *   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
 */

define('DEPLOY_SECRET', 'replace-with-a-long-random-value');
