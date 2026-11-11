import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Could not read .env.local');
}

function getEnvVar(key) {
  const lines = envContent.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/^\uFEFF/, '').trim();
    if (cleanLine.startsWith('#') || !cleanLine.includes('=')) continue;
    const [k, ...v] = cleanLine.split('=');
    if (k.trim() === key) {
      return v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return process.env[key] || '';
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || 'https://cwiljdpxgawxglgciily.supabase.co';
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function syncAll() {
  console.log('Загружаем список профилей из public.profiles...');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('profile_id, login, display_name, email, auth_user_id')
    .order('profile_id', { ascending: true });

  if (profErr) {
    console.error('Ошибка загрузки профилей:', profErr.message);
    process.exit(1);
  }

  console.log(`Найдено ${profiles.length} профилей.`);

  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Ошибка listUsers:', listErr.message);
    process.exit(1);
  }

  const existingAuthUsers = usersData.users || [];
  console.log(`Существующих пользователей в auth.users: ${existingAuthUsers.length}`);

  for (const p of profiles) {
    const email = p.email || `${p.login.toLowerCase()}@local.dev`;
    let matchedUser = existingAuthUsers.find(u => 
      u.id === p.auth_user_id || 
      u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!matchedUser) {
      console.log(`Создаём пользователя в auth.users: #${p.profile_id} ${p.login} (${email})...`);
      const { data: created, error: crErr } = await supabase.auth.admin.createUser({
        email: email,
        password: `Sakura${p.login}2026!`,
        email_confirm: true,
        user_metadata: {
          profile_id: p.profile_id,
          login: p.login,
          display_name: p.display_name
        }
      });

      if (crErr) {
        console.warn(`Не удалось создать для ${p.login} (${email}):`, crErr.message);
        continue;
      }

      matchedUser = created.user;
    }

    if (p.auth_user_id !== matchedUser.id) {
      await supabase
        .from('profiles')
        .update({ auth_user_id: matchedUser.id })
        .eq('profile_id', p.profile_id);
      console.log(`Привязали auth_user_id ${matchedUser.id} к профилю #${p.profile_id} (${p.login})`);
    }
  }

  console.log('Синхронизация профилей с Supabase Auth завершена!');
}

syncAll().catch(e => {
  console.error(e);
  process.exit(1);
});
