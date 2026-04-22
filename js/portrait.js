/* ============================================================
   ECOS DO PASSADO — Portrait Upload & Crop
   Handles image upload, zoom, pan, and crop for character portrait
   ============================================================ */

const Portrait = {
  // Galleries State
  _galleries: {
    normal: { images: [], index: 0 },
    masked: { images: [], index: 0 }
  },
  _activeMode: 'normal', // 'normal' or 'masked'

  // Crop Queue State
  _cropQueue: [],
  _currentCropIndex: 0,
  _totalToCrop: 0,

  // Crop Interactive State
  _imageData: null,
  _zoom: 100,
  _offsetX: 0,
  _offsetY: 0,
  _isDragging: false,
  _dragStartX: 0,
  _dragStartY: 0,
  _startOffsetX: 0,
  _startOffsetY: 0,
  _naturalWidth: 0,
  _naturalHeight: 0,

  // DOM references
  _els: {},

  init() {
    this._els = {
      frame: document.getElementById('portrait-frame'),
      area: document.getElementById('portrait-area'),
      placeholder: document.getElementById('portrait-placeholder'),
      img: document.getElementById('portrait-img'),
      upload: document.getElementById('portrait-upload'),
      modal: document.getElementById('crop-modal'),
      cropPreview: document.getElementById('crop-preview'),
      cropImg: document.getElementById('crop-img'),
      cropZoom: document.getElementById('crop-zoom'),
      cropConfirm: document.getElementById('crop-confirm'),
      cropCancel: document.getElementById('crop-cancel'),
      cropCounter: document.getElementById('crop-counter'),
      btnPrev: document.getElementById('portrait-prev'),
      btnNext: document.getElementById('portrait-next'),
      btnDelete: document.getElementById('portrait-delete'),
      btnModeToggle: document.getElementById('portrait-mode-toggle')
    };

    this._bindEvents();
    this.updateGalleryUI();
  },

  _bindEvents() {
    // Upload triggers
    this._els.frame.addEventListener('click', (e) => {
      this._els.upload.click();
    });

    // Drag and Drop triggers
    this._els.frame.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._els.frame.style.opacity = '0.8';
      this._els.frame.style.transform = 'scale(1.02)';
    });
    
    this._els.frame.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this._els.frame.style.opacity = '1';
      this._els.frame.style.transform = 'none';
    });
    
    this._els.frame.addEventListener('drop', (e) => {
      e.preventDefault();
      this._els.frame.style.opacity = '1';
      this._els.frame.style.transform = 'none';
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) this._startCropQueue(files);
    });

    // Gallery navigation
    if(this._els.btnPrev) this._els.btnPrev.addEventListener('click', () => this.prev());
    if(this._els.btnNext) this._els.btnNext.addEventListener('click', () => this.next());
    if(this._els.btnDelete) this._els.btnDelete.addEventListener('click', () => this.deleteCurrent());
    
    // Mode toggle
    if(this._els.btnModeToggle) this._els.btnModeToggle.addEventListener('click', () => this.toggleMode());

    // File selected
    this._els.upload.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) this._startCropQueue(files);
      e.target.value = ''; // Reset input
    });

    // Crop modal controls
    this._els.cropZoom.addEventListener('input', (e) => {
      this._zoom = parseInt(e.target.value);
      this._updateCropPreview();
    });

    this._els.cropConfirm.addEventListener('click', () => this._confirmCrop());
    this._els.cropCancel.addEventListener('click', () => this._cancelCropQueue());

    // Drag to pan in crop preview
    this._els.cropPreview.addEventListener('mousedown', (e) => this._onDragStart(e));
    document.addEventListener('mousemove', (e) => this._onDragMove(e));
    document.addEventListener('mouseup', () => this._onDragEnd());

    // Touch support
    this._els.cropPreview.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onDragStart({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this._isDragging) {
        const touch = e.touches[0];
        this._onDragMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });

    document.addEventListener('touchend', () => this._onDragEnd());

    // Mouse wheel zoom in crop preview
    this._els.cropPreview.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      this._zoom = Utils.clamp(this._zoom + delta, 100, 400);
      this._els.cropZoom.value = this._zoom;
      this._updateCropPreview();
    }, { passive: false });
  },

  // --- GALLERY LOGIC ---
  
  getActiveMode() {
    return this._activeMode;
  },

  getImages(mode = this._activeMode) {
    return this._galleries[mode].images;
  },

  getCurrentIndex(mode = this._activeMode) {
    return this._galleries[mode].index;
  },

  loadGallery(mode, images, index = 0) {
    if (!Array.isArray(images)) images = images ? [images] : [];
    this._galleries[mode].images = images;
    this._galleries[mode].index = Math.max(0, Math.min(index, this._galleries[mode].images.length - 1));
  },

  setActiveMode(mode) {
    if (mode === 'normal' || mode === 'masked') {
      this._activeMode = mode;
      this.updateGalleryUI();
    }
  },

  toggleMode() {
    this._activeMode = this._activeMode === 'normal' ? 'masked' : 'normal';
    this.updateGalleryUI();
    this._triggerCloudSync();
  },

  next() {
    const gallery = this._galleries[this._activeMode];
    if (gallery.images.length > 1) {
      gallery.index = (gallery.index + 1) % gallery.images.length;
      this.updateGalleryUI();
      this._triggerCloudSync();
    }
  },

  prev() {
    const gallery = this._galleries[this._activeMode];
    if (gallery.images.length > 1) {
      gallery.index = (gallery.index - 1 + gallery.images.length) % gallery.images.length;
      this.updateGalleryUI();
      this._triggerCloudSync();
    }
  },

  deleteCurrent() {
    const gallery = this._galleries[this._activeMode];
    if (gallery.images.length > 0) {
      gallery.images.splice(gallery.index, 1);
      if (gallery.index >= gallery.images.length) {
        gallery.index = Math.max(0, gallery.images.length - 1);
      }
      this.updateGalleryUI();
      this._triggerCloudSync();
    }
  },

  updateGalleryUI() {
    const gallery = this._galleries[this._activeMode];
    const hasImages = gallery.images.length > 0;
    
    if (hasImages) {
      this._els.img.src = gallery.images[gallery.index];
      this._els.img.style.display = 'block';
      this._els.placeholder.style.display = 'none';
    } else {
      this._els.img.removeAttribute('src');
      this._els.img.style.display = 'none';
      this._els.placeholder.style.display = '';
      
      // Update placeholder text based on mode
      if(this._activeMode === 'masked') {
        this._els.placeholder.textContent = "Clique para enviar retrato (Máscara)";
      } else {
        this._els.placeholder.textContent = "Clique para enviar retrato";
      }
    }

    // Toggle navigation buttons
    const showNav = gallery.images.length > 1;
    if (this._els.btnPrev) this._els.btnPrev.style.display = showNav ? 'block' : 'none';
    if (this._els.btnNext) this._els.btnNext.style.display = showNav ? 'block' : 'none';
    if (this._els.btnDelete) this._els.btnDelete.style.display = hasImages ? 'flex' : 'none';

    // Update Mode Toggle Button visual state
    if (this._els.btnModeToggle) {
      if (this._activeMode === 'masked') {
        this._els.btnModeToggle.classList.add('is-masked');
        this._els.frame.classList.add('is-masked');
      } else {
        this._els.btnModeToggle.classList.remove('is-masked');
        this._els.frame.classList.remove('is-masked');
      }
    }
  },

  _triggerCloudSync() {
    if (window.App) App.isDirty = true;
    if (window.Cloud && window.Cloud.session) {
      window.Cloud.saveSheetState();
    }
  },

  // --- CROP QUEUE LOGIC ---

  _startCropQueue(files) {
    this._cropQueue = files;
    this._totalToCrop = files.length;
    this._currentCropIndex = 0;
    this._loadNextInQueue();
  },

  _loadNextInQueue() {
    if (this._currentCropIndex >= this._cropQueue.length) {
      // Finished queue
      this._closeCropModal();
      this.updateGalleryUI();
      this._triggerCloudSync();
      return;
    }

    const file = this._cropQueue[this._currentCropIndex];
    if (this._els.cropCounter) {
       if(this._totalToCrop > 1) {
         this._els.cropCounter.textContent = `(${this._currentCropIndex + 1} de ${this._totalToCrop})`;
       } else {
         this._els.cropCounter.textContent = '';
       }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this._imageData = e.target.result;
      this._zoom = 100;
      this._offsetX = 0;
      this._offsetY = 0;
      this._els.cropZoom.value = 100;

      const img = this._els.cropImg;
      img.onload = () => {
        this._naturalWidth = img.naturalWidth;
        this._naturalHeight = img.naturalHeight;
        this._openCropModal();
        setTimeout(() => {
          this._updateCropPreview();
        }, 10);
      };
      img.src = this._imageData;
    };
    reader.readAsDataURL(file);
  },

  _cancelCropQueue() {
    this._closeCropModal();
    this._cropQueue = [];
  },

  _openCropModal() {
    this._els.modal.classList.add('active');
  },

  _closeCropModal() {
    this._els.modal.classList.remove('active');
  },

  // --- CROP PREVIEW & DRAG LOGIC ---

  _updateCropPreview() {
    const img = this._els.cropImg;
    const preview = this._els.cropPreview;
    const pWidth = preview.offsetWidth;
    const pHeight = preview.offsetHeight;

    const scale = (this._zoom / 100);
    const baseScale = Math.max(pWidth / this._naturalWidth, pHeight / this._naturalHeight);
    const totalScale = baseScale * scale;

    const scaledW = this._naturalWidth * totalScale;
    const scaledH = this._naturalHeight * totalScale;

    const maxOffsetX = Math.max(0, (scaledW - pWidth) / 2);
    const maxOffsetY = Math.max(0, (scaledH - pHeight) / 2);
    this._offsetX = Utils.clamp(this._offsetX, -maxOffsetX, maxOffsetX);
    this._offsetY = Utils.clamp(this._offsetY, -maxOffsetY, maxOffsetY);

    const centerX = (pWidth - scaledW) / 2 + this._offsetX;
    const centerY = (pHeight - scaledH) / 2 + this._offsetY;

    img.style.width = scaledW + 'px';
    img.style.height = scaledH + 'px';
    img.style.left = centerX + 'px';
    img.style.top = centerY + 'px';
    img.style.transform = 'none';
  },

  _onDragStart(e) {
    this._isDragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._startOffsetX = this._offsetX;
    this._startOffsetY = this._offsetY;
    this._els.cropPreview.style.cursor = 'grabbing';
  },

  _onDragMove(e) {
    if (!this._isDragging) return;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    this._offsetX = this._startOffsetX + dx;
    this._offsetY = this._startOffsetY + dy;
    this._updateCropPreview();
  },

  _onDragEnd() {
    this._isDragging = false;
    if (this._els.cropPreview) {
      this._els.cropPreview.style.cursor = 'grab';
    }
  },

  _confirmCrop() {
    const canvas = document.createElement('canvas');
    const cWidth = 352;
    const cHeight = 432;
    canvas.width = cWidth;
    canvas.height = cHeight;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.ellipse(cWidth / 2, cHeight / 2, cWidth / 2, cHeight / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const preview = this._els.cropPreview;
    const pWidth = preview.offsetWidth;
    const pHeight = preview.offsetHeight;
    const ratio = cWidth / pWidth;

    const scale = (this._zoom / 100);
    const baseScale = Math.max(pWidth / this._naturalWidth, pHeight / this._naturalHeight);
    const totalScale = baseScale * scale;

    const scaledW = this._naturalWidth * totalScale * ratio;
    const scaledH = this._naturalHeight * totalScale * ratio;
    const centerX = (cWidth - scaledW) / 2 + this._offsetX * ratio;
    const centerY = (cHeight - scaledH) / 2 + this._offsetY * ratio;

    const srcImg = new Image();
    srcImg.onload = () => {
      ctx.drawImage(srcImg, centerX, centerY, scaledW, scaledH);
      const dataUrl = canvas.toDataURL('image/png');
      
      // Save to active gallery
      const gallery = this._galleries[this._activeMode];
      gallery.images.push(dataUrl);
      gallery.index = gallery.images.length - 1; // Auto select new image
      
      // Load next in queue
      this._currentCropIndex++;
      this._loadNextInQueue();
    };
    srcImg.src = this._imageData;
  }
};
