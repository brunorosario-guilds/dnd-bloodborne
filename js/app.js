/* ============================================================
   ECOS DO PASSADO — Main Application
   Initialization, event bindings, and state management
   ============================================================ */

const App = {
  isDirty: false,
  isHydrating: false,

  /**
   * Initialize the application
   */
  init() {
    Portrait.init();
    this._bindDeathSaves();
    this._bindManualSave();

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
          if (!this.isHydrating && Cloud.session) {
            this.isDirty = true;
          }
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
   * Bind Manual saves and dirty tracking
   */
  _bindManualSave() {
    const markDirty = () => {
      if (!this.isHydrating && Cloud.session) {
        this.isDirty = true;
      }
    };

    document.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });

    // Beforeunload warning
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = 'Suas alterações recentes não foram salvas. O Pesadelo vai engoli-las se você sair agora.';
      }
    });

    const btnSave = document.getElementById('btn-save-sheet');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (Cloud.session) Cloud.saveSheetState();
      });
    }
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

        // Auto-create blank sheet so DM can observe it right away
        try {
          await this.supabase.from('character_sheets').insert({
            user_id: this.session.user.id,
            data: {}
          });
        } catch (ignored) {}

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

    const btnSave = document.getElementById('btn-save-sheet');
    if (btnSave) btnSave.style.display = 'inline-flex';
    
    // Auto-heal: Ensure ANY logged in user has a sheet right away if they somehow lack one
    try {
      const { data: ownSheets } = await this.supabase
        .from('character_sheets')
        .select('id')
        .eq('user_id', this.session.user.id)
        .limit(1);
        
      if (!ownSheets || ownSheets.length === 0) {
        await this.supabase.from('character_sheets').insert({
          user_id: this.session.user.id,
          data: {}
        });
      }
    } catch (ignored) {}
    
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
        App.isHydrating = true;
        App.hydrateAll(data.data);
        App.isHydrating = false;
        App.isDirty = false; // Reset clean
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
        let charName = sheet.data['char-name'] || 'Sem Nome';
        
        if (sheet.user_id === this.session.user.id) {
            charName += ' -PdM';
        }

        const li = document.createElement('li');
        li.textContent = charName;
        li.className = 'dm-sheet-item';
        li.addEventListener('click', () => {
          document.querySelectorAll('.dm-sheet-item').forEach(el => el.classList.remove('active'));
          li.classList.add('active');
          
          this.currentDMEditingId = sheet.id;
          
          App.isHydrating = true;
          App.hydrateAll(sheet.data);
          
          // Dispara evento 'input' nos atributos base para recalcular todos os modificadores visualmente
          const attrs = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
          attrs.forEach(attr => {
             const el = document.getElementById(`${attr}-val`);
             if (el) el.dispatchEvent(new Event('input'));
          });
          
          App.isHydrating = false;
          App.isDirty = false;
        });
        listContainer.appendChild(li);
      });
    } catch (err) {
      console.error('Failed to load sheets for DM', err);
    }
  },

  playFeedback(type) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      const toolbar = document.querySelector('.toolbar');
      toolbar.style.transition = 'background-color 0.2s, box-shadow 0.2s';

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
        
        toolbar.style.backgroundColor = 'rgba(40, 80, 40, 0.9)';
        toolbar.style.boxShadow = '0 0 15px rgba(80, 200, 80, 0.6)';
        setTimeout(() => { toolbar.style.backgroundColor = ''; toolbar.style.boxShadow = ''; }, 600);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);

        toolbar.style.backgroundColor = 'rgba(120, 20, 20, 0.9)';
        toolbar.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
        setTimeout(() => { toolbar.style.backgroundColor = ''; toolbar.style.boxShadow = ''; }, 500);
      }
    } catch(e) {}
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
        // Fallback robusto à prova de falhas: verifica existência e contorna o uso restrito de upsert.
        // Isso imuniza contra tabelas que não tiveram o constraint UNIQUE ativado corretamente.
        const { data: checkData, error: checkError } = await this.supabase
          .from('character_sheets')
          .select('id')
          .eq('user_id', this.session.user.id)
          .limit(1);
          
        if (checkError) throw checkError;

        if (checkData && checkData.length > 0) {
          // Atualiza registro existente (Update)
          const { error } = await this.supabase
            .from('character_sheets')
            .update({ data: state })
            .eq('id', checkData[0].id);
          if (error) throw error;
        } else {
          // Insere pela primeira vez (Insert)
          const { error } = await this.supabase
            .from('character_sheets')
            .insert({ user_id: this.session.user.id, data: state });
          if (error) throw error;
        }
      }
      this.playFeedback('success');
      document.getElementById('auth-status').textContent = `Ecos do Passado — ✅ Salvo na Nuvem`;
      App.isDirty = false;

      setTimeout(() => {
        document.getElementById('auth-status').textContent = this.isDM ? `Ecos do Passado — Mestre da Mesa` : `Ecos do Passado — Sincronizado`;
      }, 3000);
      
    } catch (err) {
      console.error(err);
      this.playFeedback('error');
      document.getElementById('auth-status').textContent = `Erro Fatal: ${err.message}`;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Cloud.init();
  App.init();
});
