const fs = require('fs');
const path = require('path');

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    process.exit(1);
}

// Create a config file that will be used by the frontend
const configContent = `
// Auto-generated configuration file
// This file is created during build and contains environment variables
window.SUPABASE_CONFIG = {
    url: '${supabaseUrl}',
    anonKey: '${supabaseAnonKey}'
};
`;

// Write the config file
fs.writeFileSync(path.join(__dirname, '../scripts/config-generated.js'), configContent);
console.log('✅ Configuration file generated successfully');

// Copy all files to build directory (if needed)
console.log('✅ Build completed');