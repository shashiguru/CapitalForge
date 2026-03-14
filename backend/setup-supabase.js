#!/usr/bin/env node

/**
 * Interactive Supabase Setup Script for CapitalForge
 * 
 * This script helps you configure the backend to connect to Supabase
 * by interactively collecting your connection details.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateJwtSecret() {
  return require('crypto').randomBytes(32).toString('base64');
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  CapitalForge - Supabase Configuration Setup');
  console.log('='.repeat(60) + '\n');

  console.log('This script will help you configure your backend to connect to Supabase.\n');
  console.log('You\'ll need the following from your Supabase project:');
  console.log('  1. Connection Pooling URL (port 6543)');
  console.log('  2. Direct Connection URL (port 5432)');
  console.log('  3. (Optional) Project URL and API keys\n');

  console.log('📍 Get these from: Supabase Dashboard → Settings → Database\n');

  const useInteractive = await question('Do you want to enter your Supabase credentials now? (y/n): ');

  if (useInteractive.toLowerCase() !== 'y') {
    console.log('\n✅ No problem! You can manually edit the .env file later.');
    console.log('   Copy .env.example to .env and fill in your credentials.\n');
    rl.close();
    return;
  }

  console.log('\n' + '-'.repeat(60));
  console.log('  Step 1: Database Connection Strings');
  console.log('-'.repeat(60) + '\n');

  const databaseUrl = await question('Enter your CONNECTION POOLING URL (port 6543):\n> ');
  const directUrl = await question('\nEnter your DIRECT CONNECTION URL (port 5432):\n> ');

  console.log('\n' + '-'.repeat(60));
  console.log('  Step 2: Optional Supabase Configuration');
  console.log('-'.repeat(60) + '\n');

  const includeOptional = await question('Include optional Supabase URL and keys? (y/n): ');
  
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  let supabaseServiceKey = '';

  if (includeOptional.toLowerCase() === 'y') {
    supabaseUrl = await question('\nEnter your Supabase Project URL (https://xxxxx.supabase.co):\n> ');
    supabaseAnonKey = await question('\nEnter your Supabase Anon/Public Key:\n> ');
    supabaseServiceKey = await question('\nEnter your Supabase Service Role Key:\n> ');
  }

  console.log('\n' + '-'.repeat(60));
  console.log('  Step 3: Application Configuration');
  console.log('-'.repeat(60) + '\n');

  const jwtSecret = await question(`Enter JWT Secret (press Enter to auto-generate):\n> `) || generateJwtSecret();
  const port = await question('Enter backend port (default: 3001):\n> ') || '3001';

  // Create .env content
  const envContent = `# Supabase Database Connection
DATABASE_URL="${databaseUrl.trim()}"
DIRECT_URL="${directUrl.trim()}"

${includeOptional.toLowerCase() === 'y' ? `# Supabase Project Configuration
SUPABASE_URL="${supabaseUrl.trim()}"
SUPABASE_ANON_KEY="${supabaseAnonKey.trim()}"
SUPABASE_SERVICE_ROLE_KEY="${supabaseServiceKey.trim()}"
` : '# Supabase Project Configuration (Optional)\n# SUPABASE_URL=""\n# SUPABASE_ANON_KEY=""\n# SUPABASE_SERVICE_ROLE_KEY=""\n'}
# JWT Configuration
JWT_SECRET="${jwtSecret}"
JWT_EXPIRATION="7d"

# Application
PORT=${port}
NODE_ENV=development

# Bucket Ratios (configurable)
CORE_BUCKET_RATIO=0.6
DIP_BUCKET_RATIO=0.3
CRASH_BUCKET_RATIO=0.1

# Yahoo Finance
YAHOO_RETRY_ATTEMPTS=3
YAHOO_RETRY_DELAY=1000
`;

  // Write .env file
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await question('\n⚠️  .env file already exists. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('\n❌ Setup cancelled. Your existing .env file was not modified.\n');
      rl.close();
      return;
    }
  }

  fs.writeFileSync(envPath, envContent);

  console.log('\n' + '='.repeat(60));
  console.log('  ✅ Configuration Complete!');
  console.log('='.repeat(60) + '\n');

  console.log('Your .env file has been created successfully!\n');
  console.log('Next steps:\n');
  console.log('  1. Install dependencies:');
  console.log('     npm install\n');
  console.log('  2. Generate Prisma Client:');
  console.log('     npx prisma generate\n');
  console.log('  3. Run database migrations:');
  console.log('     npx prisma migrate dev --name init\n');
  console.log('  4. Seed demo data:');
  console.log('     npx prisma db seed\n');
  console.log('  5. Start the server:');
  console.log('     npm run start:dev\n');

  const runNow = await question('Would you like to run these commands now? (y/n): ');

  if (runNow.toLowerCase() === 'y') {
    console.log('\n🚀 Starting setup process...\n');
    rl.close();

    const { execSync } = require('child_process');

    try {
      console.log('📦 Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });

      console.log('\n🔧 Generating Prisma Client...');
      execSync('npx prisma generate', { stdio: 'inherit' });

      console.log('\n📊 Running database migrations...');
      execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

      console.log('\n🌱 Seeding database...');
      execSync('npx prisma db seed', { stdio: 'inherit' });

      console.log('\n' + '='.repeat(60));
      console.log('  ✅ Setup Complete!');
      console.log('='.repeat(60) + '\n');

      console.log('Your backend is ready to run!\n');
      console.log('Start the server with:');
      console.log('  npm run start:dev\n');

    } catch (error) {
      console.error('\n❌ Error during setup:', error.message);
      console.log('\nPlease run the commands manually:\n');
      console.log('  npm install');
      console.log('  npx prisma generate');
      console.log('  npx prisma migrate dev --name init');
      console.log('  npx prisma db seed');
      console.log('  npm run start:dev\n');
    }
  } else {
    console.log('Run the commands above when you\'re ready!\n');
    rl.close();
  }
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
