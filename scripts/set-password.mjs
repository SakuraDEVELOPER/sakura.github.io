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

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log(`
Использование:
  node scripts/set-password.mjs <логин_или_email> <новый_пароль> [новый_email]

Примеры:
  node scripts/set-password.mjs admin SuperSecretPass123
  node scripts/set-password.mjs admin SuperSecretPass123 myrealmail@gmail.com
  node scripts/set-password.mjs test@123.123 NewPass456
`);
  process.exit(0);
}

const identifier = args[0].trim();
const newPassword = args[1].trim();
const newEmail = args[2] ? args[2].trim() : null;

async function main() {
  console.log(`Ищем пользователя «${identifier}» в базе Supabase...`);

  // 1. Поиск профиля по login или email
  let profile = null;
  const { data: byLogin } = await supabase
    .from('profiles')
    .select('*')
    .ilike('login', identifier)
    .maybeSingle();

  if (byLogin) {
    profile = byLogin;
  } else {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', identifier)
      .maybeSingle();
    if (byEmail) {
      profile = byEmail;
    }
  }

  const targetEmail = newEmail || profile?.email || (identifier.includes('@') ? identifier : `${identifier}@example.com`);
  console.log(`Профиль: ${profile ? `ID #${profile.profile_id} (логин: ${profile.login}, email: ${profile.email})` : 'не найден в profiles'}`);
  console.log(`Целевой email для Supabase Auth: ${targetEmail}`);

  // 2. Ищем пользователя в auth.users
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Ошибка listUsers:', listErr.message);
    process.exit(1);
  }

  let authUser = usersData.users.find(u => 
    u.email?.toLowerCase() === targetEmail.toLowerCase() ||
    (profile?.auth_user_id && u.id === profile.auth_user_id) ||
    (profile?.email && u.email?.toLowerCase() === profile.email.toLowerCase())
  );

  let authUserId = null;

  if (authUser) {
    console.log(`Пользователь найден в auth.users (ID: ${authUser.id}). Обновляем пароль...`);
    const updatePayload = {
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        ...(authUser.user_metadata || {}),
        login: profile?.login || identifier,
        display_name: profile?.display_name || identifier,
        profile_id: profile?.profile_id
      }
    };
    if (newEmail && newEmail.toLowerCase() !== authUser.email?.toLowerCase()) {
      updatePayload.email = newEmail;
    }

    const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(authUser.id, updatePayload);
    if (updateErr) {
      console.error('Ошибка при обновлении пользователя:', updateErr.message);
      process.exit(1);
    }
    authUserId = updated.user.id;
    console.log(`Пароль успешно обновлён в Supabase Auth!`);
  } else {
    console.log(`Пользователь отсутствует в auth.users. Создаём нового пользователя в Supabase Auth...`);
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: targetEmail,
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        login: profile?.login || identifier,
        display_name: profile?.display_name || identifier,
        profile_id: profile?.profile_id
      }
    });

    if (createErr) {
      console.error('Ошибка при создании пользователя в auth.users:', createErr.message);
      process.exit(1);
    }
    authUserId = created.user.id;
    console.log(`Пользователь создан в Supabase Auth (ID: ${authUserId}) с подтверждённым email!`);
  }

  // 3. Синхронизируем profiles если нужно
  if (profile) {
    const updateProfile = {};
    if (profile.auth_user_id !== authUserId) {
      updateProfile.auth_user_id = authUserId;
    }
    if (newEmail && profile.email !== newEmail) {
      updateProfile.email = newEmail;
    }
    if (Object.keys(updateProfile).length > 0) {
      const { error: profErr } = await supabase
        .from('profiles')
        .update(updateProfile)
        .eq('profile_id', profile.profile_id);
      if (profErr) {
        console.warn('Предупреждение: не удалось обновить auth_user_id в profiles:', profErr.message);
      } else {
        console.log(`Таблица profiles обновлена (auth_user_id: ${authUserId}${newEmail ? `, email: ${newEmail}` : ''}).`);
      }
    }
  }

  console.log(`\nГотово! Вы можете войти с:`);
  console.log(`   Логин / Email: ${profile?.login || targetEmail}`);
  console.log(`   Пароль: ${newPassword}`);
}

main().catch(err => {
  console.error('Непредвиденная ошибка:', err);
  process.exit(1);
});
