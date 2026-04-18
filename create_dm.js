const { createClient } = require('@supabase/supabase-js');

const PROJECT_URL = 'https://roiqfjrkzajstnmwqrlq.supabase.co';
const ANON_KEY = 'sb_publishable_BTSGfwTVSnyjIadvQcLPuQ_61f6a7KU';
const supabase = createClient(PROJECT_URL, ANON_KEY);

async function createDM() {
  console.log("Criando DM...");
  const fakeEmail = 'deltamike@pesadelo.com';
  const passInput = 'deltamike';

  const { data, error } = await supabase.auth.signUp({
    email: fakeEmail,
    password: passInput,
  });

  if (error) {
    console.error("Erro ao criar DM:", error.message);
  } else {
    console.log("DM criado com sucesso!", data);
  }
}

createDM();
