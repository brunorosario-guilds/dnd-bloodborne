/* ============================================================
   ECOS DO PASSADO — Main Application
   Initialization, event bindings, and state management
   ============================================================ */

const App = {
  /**
   * Initialize the application
   */
  init() {
    Portrait.init();
    Export.init();
    this._bindDeathSaves();
    this._bindAutoSave();

    // Load saved data if exists
    this._loadFromStorage();
    
    // Calculate and bind modifiers after loading storage
    this._bindModifiers();
    this._bindSkillModifiers();

    console.log('⚔️ Ecos do Passado — Ficha carregada.');
  },

  /**
   * Bind death save dot toggles (Falhas & Mortes)
   */
  _bindDeathSaves() {
    const containers = ['falhas-dots', 'mortes-dots'];
    containers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.querySelectorAll('.death-save-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          dot.classList.toggle('filled');
          if (Cloud.session) Cloud.saveSheetState();
        });
      });
    });
  },

  /**
   * Bind automated stat modifier calculation
   */
  _bindModifiers() {
    const attributes = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
    
    attributes.forEach(attr => {
      const valInput = document.getElementById(`${attr}-val`);
      const modInput = document.getElementById(`${attr}-mod`);
      
      if (!valInput || !modInput) return;
      
      const calculateMod = () => {
        const score = parseInt(valInput.value, 10);
        if (isNaN(score)) {
          modInput.value = '';
          return;
        }
        // D&D Formula: -10 = 0, every 2 above adds +1, every 2 below subtracts -1
        let modifier = Math.floor((score - 10) / 2);
        // Format with + sign if positive
        modInput.value = modifier > 0 ? `+${modifier}` : modifier;
        
        // Espelhar diretamente para a Iniciativa (caso seja Destreza)
        if (attr === 'destreza') {
          const initInput = document.getElementById('iniciativa');
          if (initInput) initInput.value = modInput.value;
        }
      };
      
      valInput.addEventListener('input', calculateMod);
      // Run once on load to initialize saved data properly
      calculateMod();
    });
  },

  /**
   * Bind automated skill proficiency modifiers
   */
  _bindSkillModifiers() {
    const profInput = document.getElementById('proficiencia');
    // Map of skills to their respective attribute base
    const skillsMap = {
      'atletismo': 'forca',
      'acrobacia': 'destreza',
      'furtividade': 'destreza',
      'prestidigitacao': 'destreza',
      'arcanismo': 'inteligencia',
      'historia': 'inteligencia',
      'investigacao': 'inteligencia',
      'natureza': 'inteligencia',
      'religiao': 'inteligencia',
      'animais': 'sabedoria',
      'medicina': 'sabedoria',
      'percepcao': 'sabedoria',
      'sobrevivencia': 'sabedoria',
      'atuacao': 'carisma',
      'blefar': 'carisma',
      'intimidacao': 'carisma',
      'persuasao': 'carisma'
    };

    const updateAllSkills = () => {
      // Perícias
      Object.keys(skillsMap).forEach(skill => {
        const attr = skillsMap[skill];
        const cb = document.getElementById(`skill-${skill}-prof`);
        const modField = document.getElementById(`skill-${skill}-mod`);
        const baseModField = document.getElementById(`${attr}-mod`);
        
        if (!cb || !modField || !baseModField) return;
        
        let baseMod = parseInt(baseModField.value, 10);
        if (isNaN(baseMod)) baseMod = 0;
        
        let profBonus = 0;
        if (cb.checked) {
           profBonus = parseInt(profInput ? profInput.value : '0', 10);
           if (isNaN(profBonus)) profBonus = 0;
        }
        
        let total = baseMod + profBonus;
        modField.value = total >= 0 ? `+${total}` : total;
      });

      // Testes de Habilidade (Saves)
      const attributes = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
      attributes.forEach(attr => {
        const cb = document.getElementById(`save-${attr}-prof`);
        const modField = document.getElementById(`save-${attr}-mod`);
        const baseModField = document.getElementById(`${attr}-mod`);
        
        if (!cb || !modField || !baseModField) return;
        
        let baseMod = parseInt(baseModField.value, 10);
        if (isNaN(baseMod)) baseMod = 0;
        
        let profBonus = 0;
        if (cb.checked) {
           profBonus = parseInt(profInput ? profInput.value : '0', 10);
           if (isNaN(profBonus)) profBonus = 0;
        }
        
        let total = baseMod + profBonus;
        modField.value = total >= 0 ? `+${total}` : total;
      });
    };

    // Listen to changes on proficiencia
    if (profInput) profInput.addEventListener('input', updateAllSkills);

    // Listen to skill checkboxes
    Object.keys(skillsMap).forEach(skill => {
      const cb = document.getElementById(`skill-${skill}-prof`);
      if (cb) cb.addEventListener('change', updateAllSkills);
    });

    // Listen to save checkboxes
    const attributes = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
    attributes.forEach(attr => {
      const cb = document.getElementById(`save-${attr}-prof`);
      if (cb) cb.addEventListener('change', updateAllSkills);
    });

    // Listen to attribute changes (to sync base attribute modifiers passing through)
    attributes.forEach(attr => {
      const valInput = document.getElementById(`${attr}-val`);
      if (valInput) {
        valInput.addEventListener('input', () => { setTimeout(updateAllSkills, 0); });
      }
    });

    // Initial run
    setTimeout(updateAllSkills, 0);
  },

  /**
   * Bind Nuvem saves to blur events strictly
   */
  _bindAutoSave() {
    // Módulo de save silencioso na nuvem (somente quando sair do foco/encerrar edição)
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
      input.addEventListener('blur', () => {
        if (Cloud.session) Cloud.saveSheetState();
      });
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (Cloud.session) Cloud.saveSheetState();
      });
    });
  },

  /**
   * Re-hydrates layout from a pure JSON payload
   */
  hydrateAll(data) {
    if (!data) return;

    // Restore text/number inputs
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
      if (input.id && data[input.id] !== undefined) {
        input.value = data[input.id];
      }
    });

    // Restore textareas
    document.querySelectorAll('textarea').forEach(ta => {
      if (ta.id && data[ta.id] !== undefined) {
        ta.value = data[ta.id];
      }
    });

    // Restore checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.id && data[cb.id] !== undefined) {
        cb.checked = data[cb.id];
      }
    });

    // Restore death save dots
    ['falhas-dots', 'mortes-dots'].forEach(containerId => {
      if (data[containerId]) {
        const dots = document.querySelectorAll(`#${containerId} .death-save-dot`);
        data[containerId].forEach((filled, i) => {
          if (dots[i] && filled) dots[i].classList.add('filled');
        });
      }
    });

    // Restore portrait
    if (data['portrait-src']) {
      const portraitImg = document.getElementById('portrait-img');
      const placeholder = document.getElementById('portrait-placeholder');
      if (portraitImg && placeholder) {
        portraitImg.src = data['portrait-src'];
        portraitImg.style.display = 'block';
        placeholder.style.display = 'none';
      }
    }
  },

  /**
   * Sucks entire form into a JSON Object
   */
  serializeState() {
    const data = {};

    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
      if (input.id) data[input.id] = input.value;
    });

    document.querySelectorAll('textarea').forEach(ta => {
      if (ta.id) data[ta.id] = ta.value;
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.id) data[cb.id] = cb.checked;
    });

    ['falhas-dots', 'mortes-dots'].forEach(containerId => {
      const dots = document.querySelectorAll(`#${containerId} .death-save-dot`);
      data[containerId] = Array.from(dots).map(d => d.classList.contains('filled'));
    });

    const portraitImg = document.getElementById('portrait-img');
    if (portraitImg && portraitImg.style.display !== 'none' && portraitImg.src) {
      data['portrait-src'] = portraitImg.src;
    }

    return data;
  }
};

/* ============================================================
   SUPABASE CLOUD MODULE
   ============================================================ */
const Cloud = {
  supabase: null,
  session: null,
  isDM: false,
  currentDMEditingId: null,

  init() {
    const PROJECT_URL = 'https://roiqfjrkzajstnmwqrlq.supabase.co';
    const ANON_KEY = 'sb_publishable_BTSGfwTVSnyjIadvQcLPuQ_61f6a7KU';
    
    // Injeção do SDK foi feita no HTML (window.supabase)
    this.supabase = window.supabase.createClient(PROJECT_URL, ANON_KEY);

    this.bindDOM();
    this.checkSession();
  },

  bindDOM() {
    document.getElementById('btn-cloud-login').addEventListener('click', () => this.handleAuth('login'));
    document.getElementById('btn-cloud-register').addEventListener('click', () => this.handleAuth('register'));
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());
    
    // Enter key submit nas caixas do modal
    const inputs = ['auth-username', 'auth-password'];
    inputs.forEach(id => {
      document.getElementById(id).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleAuth('login');
      });
    });
  },

  async checkSession() {
    const { data } = await this.supabase.auth.getSession();
    if (data.session) {
      this.session = data.session;
      await this.enterRealm();
    } else {
      document.getElementById('cloud-modal').classList.remove('hidden');
    }
  },

  async handleAuth(mode) {
    const userInput = document.getElementById('auth-username').value.trim();
    const passInput = document.getElementById('auth-password').value.trim();
    const errorTarget = document.getElementById('auth-error');

    errorTarget.textContent = '';

    if (!userInput || !passInput) {
      errorTarget.textContent = 'Nome e Senha são cruciais no Pesadelo.';
      return;
    }

    if (passInput.length < 6) {
      errorTarget.textContent = 'Senhas de Caçador precisam ter no mínimo 6 caracteres.';
    }

    // Shadow-Email system
    const fakeEmail = `${userInput.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@bloodborne.com`;

    document.getElementById('btn-cloud-login').disabled = true;
    document.getElementById('btn-cloud-register').disabled = true;

    try {
      if (mode === 'register') {
        const { data, error } = await this.supabase.auth.signUp({
          email: fakeEmail,
          password: passInput,
        });

        if (error) {
          if (error.message.includes('already registered')) throw new Error('Caçador já existe. Tente "Entrar".');
          throw error;
        }

        this.session = data.session;
        await this.enterRealm();
        
      } else if (mode === 'login') {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: passInput,
        });

        if (error) {
          if (error.message.includes('Invalid login')) throw new Error('Nome ou senha incorretos.');
          throw error;
        }

        this.session = data.session;
        await this.enterRealm();
      }
    } catch (err) {
      errorTarget.textContent = err.message;
    }

    document.getElementById('btn-cloud-login').disabled = false;
    document.getElementById('btn-cloud-register').disabled = false;
  },

  async logout() {
    await this.supabase.auth.signOut();
    window.location.reload();
  },

  async enterRealm() {
    document.getElementById('cloud-modal').classList.add('hidden');
    document.getElementById('btn-logout').style.display = 'block';
    
    if (this.session.user.email === 'deltamike@bloodborne.com') {
      this.isDM = true;
      document.getElementById('auth-status').textContent = `Ecos do Passado — Mestre da Mesa`;
      await this.loadDMView();
      return;
    }
    
    document.getElementById('auth-status').textContent = `Ecos do Passado — Sincronizado`;

    // Fetch User's data
    try {
      const { data, error } = await this.supabase
        .from('character_sheets')
        .select('*')
        .eq('user_id', this.session.user.id)
        .single();
        
      if (data && data.data) {
        App.hydrateAll(data.data);
      }
    } catch (error) {
      // Ignora erro - usualmente significa q tabela está vazia (linha recém criado)
      console.log('Ficha em branco detetada, ou primeiro acesso.');
    }

    // Process dependent stats
    App._bindModifiers();
    App._bindSkillModifiers();
  },

  async loadDMView() {
    const dmPanel = document.getElementById('dm-panel');
    if (dmPanel) dmPanel.classList.remove('hidden');

    try {
      const { data, error } = await this.supabase
        .from('character_sheets')
        .select('*');
        
      if (error) throw error;

      const listContainer = document.getElementById('dm-sheet-list');
      listContainer.innerHTML = '';
      
      data.forEach(sheet => {
        const charName = sheet.data['char-name'] || 'Ficha Sem Nome';
        const playerClass = sheet.data['classe'] || 'Desconhecido';
        
        const li = document.createElement('li');
        li.textContent = `${charName} (${playerClass})`;
        li.className = 'dm-sheet-item';
        li.addEventListener('click', () => {
          document.querySelectorAll('.dm-sheet-item').forEach(el => el.classList.remove('active'));
          li.classList.add('active');
          
          this.currentDMEditingId = sheet.id;
          App.hydrateAll(sheet.data);
          
          // Dispara evento 'input' nos atributos base para recalcular todos os modificadores visualmente
          const attrs = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
          attrs.forEach(attr => {
             const el = document.getElementById(`${attr}-val`);
             if (el) el.dispatchEvent(new Event('input'));
          });
        });
        listContainer.appendChild(li);
      });
    } catch (err) {
      console.error('Failed to load sheets for DM', err);
    }
  },

  async saveSheetState() {
    if (!this.session) return;
    document.getElementById('auth-status').textContent = `Ecos do Passado — ⏳ Salvando...`;

    const state = App.serializeState();
    
    try {
      if (this.isDM) {
        if (!this.currentDMEditingId) {
          document.getElementById('auth-status').textContent = `Mestre da Mesa (Selecione uma ficha)`;
          return; // Nada selecionado
        }

        const { error } = await this.supabase
          .from('character_sheets')
          .update({ data: state })
          .eq('id', this.currentDMEditingId);

        if (error) throw error;
      } else {
        const { error } = await this.supabase
          .from('character_sheets')
          .upsert({
            user_id: this.session.user.id,
            data: state
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('Save failed:', error);
          document.getElementById('auth-status').textContent = `Erro: ${error.message}`;
          return;
        }
      }
      
      document.getElementById('auth-status').textContent = `Ecos do Passado — ✅ Salvo na Nuvem`;
      setTimeout(() => {
        document.getElementById('auth-status').textContent = this.isDM ? `Ecos do Passado — Mestre da Mesa` : `Ecos do Passado — Sincronizado`;
      }, 3000);
      
    } catch (err) {
      console.error(err);
      document.getElementById('auth-status').textContent = `Erro: ${err.message}`;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Cloud.init();
  App.init();
});
