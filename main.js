// ==================================================
// VaDA Video Switcher - COMPLETE main.js
// ==================================================

// Global state
let pc = null;
let activeEl = null;
let globalVolume = 1.0;

let lastActiveTab = "overlay";
let lastActiveTitle = "Overlay / DSK";

// WebRTC Setup (one connection for all cameras)
// === 1. UPDATED WebRTC Setup (Handles the Handshake) ===
const initWebRTC = async () => {
  try {
    const rtcConfig = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    pc = new RTCPeerConnection(rtcConfig);

    // This is the "Ear" that listens for the video track coming from Electron
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;

      // We look for the cam-item that is currently "selected"
      const selectedSlot = document.querySelector(
        ".cam-item.selected .cam-preview-area",
      );

      if (selectedSlot) {
        let video = selectedSlot.querySelector("video");
        if (!video) {
          video = document.createElement("video");
          video.autoplay = true;
          video.playsinline = true;
          video.muted = true; // Crucial for Autoplay
          video.style.width = "100%";
          video.style.height = "100%";
          video.style.objectFit = "cover";
          selectedSlot.appendChild(video);
        }

        video.srcObject = remoteStream;
        video.play().catch((e) => console.warn("Auto-play blocked:", e));

        const placeholder = selectedSlot.querySelector(".placeholder-text");
        if (placeholder) placeholder.style.display = "none";

        // IMPORTANT: If this is the first stream, or we want it in Preview immediately:
        const mainPreview = document.getElementById("v-preview");
        if (mainPreview && !mainPreview.srcObject) {
          mainPreview.srcObject = remoteStream;
          mainPreview.play();
          document.querySelector(
            ".monitor.preview .placeholder-text",
          ).style.display = "none";
        }
      }
    };

    // HANDSHAKE: Create the Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Communicate with Vada Bridge
    if (window.vadaAPI && window.vadaAPI.sendOffer) {
      window.vadaAPI.sendOffer(offer);
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate && window.vadaAPI)
        window.vadaAPI.sendCandidate(ev.candidate);
    };

    // This part is CRITICAL: It catches the 'Answer' from Electron
    if (window.vadaAPI && window.vadaAPI.onWebRTCAnswer) {
      window.vadaAPI.onWebRTCAnswer(async (answer) => {
        console.log("📥 Received WebRTC Answer from Backend");
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });
    }

    console.log("✅ WebRTC Ready & Offer Sent");
  } catch (err) {
    console.error("WebRTC Error:", err);
  }
};

// Joystick handler
const handleMove = (e) => {
  if (!activeEl) return;
  const rect = activeEl.parentElement.getBoundingClientRect();

  if (activeEl.id === "joy-stick") {
    const centerX = rect.width / 2,
      centerY = rect.height / 2;
    let dx = e.clientX - rect.left - centerX;
    let dy = e.clientY - rect.top - centerY;
    const max = rect.width / 2 - 20;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > max) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * max;
      dy = Math.sin(angle) * max;
    }
    activeEl.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (activeEl.classList.contains("fine-handle")) {
    const isH =
      activeEl.parentElement.parentElement.classList.contains("horizontal");
    let pct = isH
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
    pct = Math.max(0, Math.min(pct, 100));
    isH ? (activeEl.style.left = pct + "%") : (activeEl.style.top = pct + "%");
  }
};

const syncSockets = () => {
  document.querySelectorAll(".fine-handle").forEach((h) => {
    h.style.left = "50%";
    h.style.top = "50%";
    h.style.transform = "translate(-50%, -50%)";
  });
  const joyStick = document.getElementById("joy-stick");
  if (joyStick) joyStick.style.transform = "translate(0,0)";
};

// MAIN INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 VaDA Switcher - FULLY LOADED");

  const cameraGrid = document.getElementById("dynamic-camera-grid");
  const mixerContainer = document.getElementById("dynamic-mixer-area");
  const bottomArea = document.querySelector(".bottom-area");
  const inspectorTitle = document.getElementById("inspector-title");
  const menu = document.getElementById("sidebar-popup-menu");
  const trigger = document.getElementById("popup-trigger");
  const inputMenu = document.getElementById("input-context-menu");
  const ndiList = document.getElementById("ndi-sources-list");
  let currentTargetSlot = null;

  // === 1. GENERATE CAMERAS ===
  if (cameraGrid) {
    cameraGrid.innerHTML = "";
    for (let i = 1; i <= 8; i++) {
      const cam = document.createElement("div");
      cam.className = "cam-item";
      cam.draggable = true; // Enable Dragging
      let draggedStream = null;

      cameraGrid.addEventListener("dragstart", (e) => {
        const camItem = e.target.closest(".cam-item");
        const video = camItem?.querySelector("video");
        if (video && video.srcObject) {
          draggedStream = video.srcObject;
          e.dataTransfer.setData(
            "text/plain",
            camItem.querySelector("span").innerText,
          );
        }
      });

      const previewMonitor = document.querySelector(".monitor.preview");
      previewMonitor.addEventListener("dragover", (e) => e.preventDefault());
      previewMonitor.addEventListener("drop", (e) => {
        e.preventDefault();
        const vPreview = document.getElementById("v-preview");
        const placeholder = previewMonitor.querySelector(".placeholder-text");

        if (draggedStream && vPreview) {
          vPreview.srcObject = draggedStream;
          vPreview.muted = true;
          vPreview
            .play()
            .catch((err) => console.error("Drop Play Error:", err));

          if (placeholder) placeholder.style.display = "none";

          // Tally Update based on cam name
          const camName = e.dataTransfer.getData("text/plain");
          document.querySelectorAll(".cam-item").forEach((c) => {
            if (!c.classList.contains("warning"))
              c.style.borderColor = "transparent";
            if (c.querySelector("span").innerText === camName)
              c.style.borderColor = "var(--accent-blue)";
          });
        }
      });

      cam.innerHTML = `
<div class="cam-label-bar">
    <div class="progress-bar"></div> 
    
    <div class="cam-label">
        <span>4K60P ${i}</span>
    </div>
    
    <div class="cam-settings-trigger" data-cam="${i}">
        <span></span><span></span><span></span>
    </div>
</div>
<div class="cam-preview-area" id="video-slot-${i}">
    <div class="placeholder-text">CAM ${i}</div>
</div>`;
      cameraGrid.appendChild(cam);
    }
    console.log("✅ 8 Cameras Created");
  }

  // === 2. DRAG AND DROP LOGIC ===
  cameraGrid?.addEventListener("dragstart", (e) => {
    const camItem = e.target.closest(".cam-item");
    if (camItem) {
      e.dataTransfer.setData("camId", camItem.querySelector("span").innerText);
      // Store reference to the source video stream
      const video = camItem.querySelector("video");
      if (video && video.srcObject) {
        window._draggedStream = video.srcObject;
      }
    }
  });

  const previewMonitor = document.querySelector(".monitor.preview");
  previewMonitor?.addEventListener("dragover", (e) => e.preventDefault());
  previewMonitor?.addEventListener("drop", (e) => {
    e.preventDefault();
    if (window._draggedStream) {
      const previewVideo = document.getElementById("v-preview");
      const placeholder = previewMonitor.querySelector(".placeholder-text");
      previewVideo.srcObject = window._draggedStream;
      if (placeholder) placeholder.style.display = "none";

      // Highlight source camera in Blue
      const camName = e.dataTransfer.getData("camId");
      document.querySelectorAll(".cam-item").forEach((c) => {
        if (!c.classList.contains("warning"))
          c.style.borderColor = "transparent";
        if (c.querySelector("span").innerText === camName) {
          c.style.borderColor = "var(--accent-blue)";
        }
      });
      console.log("🖱️ Drag-Drop to Preview Successful");
    }
  });

// === 3. DOUBLE-CLICK TO PREVIEW (FIXED) ===
cameraGrid?.addEventListener("dblclick", (e) => {
    const camItem = e.target.closest(".cam-item");
    // Find the video element inside the clicked camera slot
    const sourceVideo = camItem?.querySelector("video");
    const previewVideo = document.getElementById("v-preview");
    const previewPlaceholder = document.querySelector(".monitor.preview .placeholder-text");

    // CRITICAL CHECK: Does the source camera actually have a running stream?
    if (sourceVideo && sourceVideo.srcObject && previewVideo) {
        console.log("📺 Staging Stream to Preview...");
        
        // Transfer the stream object
        previewVideo.srcObject = sourceVideo.srcObject;
        previewVideo.muted = true;
        
        previewVideo.play()
            .then(() => {
                if (previewPlaceholder) previewPlaceholder.style.display = "none";
                
                // Clear UI states and set Blue Tally
                document.querySelectorAll(".cam-item").forEach(c => {
                    c.classList.remove("staged-preview");
                    if (!c.classList.contains("warning")) c.style.borderColor = "transparent";
                });
                camItem.classList.add("staged-preview");
                camItem.style.borderColor = "var(--accent-blue)";
            })
            .catch(err => console.error("Preview Playback Failed:", err));
    } else {
        console.warn("⚠️ Cannot Stage: Source camera has no active WebRTC stream.");
    }
});
  // === 4. THE TAKE ACTION (REPLACED) ===
const executeTake = () => {
    const previewVideo = document.getElementById("v-preview");
    const programVideo = document.getElementById("v-program");
    const programPlaceholder = document.querySelector(".monitor.program .placeholder-text");

    if (!previewVideo || !previewVideo.srcObject) {
        console.warn("Switching failed: No stream in Preview.");
        return;
    }

    // 1. Transfer the stream
    programVideo.srcObject = previewVideo.srcObject;

    // 2. Critical: WebRTC streams often need a manual trigger to resume playback on a new element
    programVideo.play()
        .then(() => {
            console.log("🔴 PROGRAM IS LIVE");
            if (programPlaceholder) programPlaceholder.style.display = "none";
        })
        .catch(err => console.error("Program Playback Error:", err));

    // 3. Update Tally
    const stagedCam = document.querySelector(".cam-item.staged-preview");
    document.querySelectorAll(".cam-item").forEach(c => c.classList.remove("warning"));
    if (stagedCam) {
        stagedCam.classList.remove("staged-preview");
        stagedCam.classList.add("warning");
    }
};
  // Bind the function to your buttons
  document.getElementById("take-btn")?.addEventListener("click", executeTake);
  document
    .getElementById("take-execute")
    ?.addEventListener("click", executeTake);

  document.getElementById("take-btn")?.addEventListener("click", executeTake);
  document
    .getElementById("take-execute")
    ?.addEventListener("click", executeTake);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      // Prevent scrolling with spacebar
      if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        executeTake();
      }
    }
  });

  // === 5. GENERATE MIXER ===
  if (mixerContainer) {
    for (let i = 1; i <= 16; i++) {
      const ch = document.createElement("div");
      ch.className = "mixer-channel";
      ch.innerHTML = `
        <div class="cam-peek-container">
          <div class="cam-peek-thumb" id="peek-label-${i}">CH ${i}</div>
        </div>
        <div class="stereo-unit-recessed">
          <div class="meter-track"><div class="meter-fill"></div></div>
          <div class="meter-track"><div class="meter-fill"></div></div>
        </div>
        <div class="ms-display">10 ms</div>
        <button class="mute-btn-vada">
          <img src="assets/icons/audio-icon-mute.svg" alt="Mute">
        </button>`;
      mixerContainer.appendChild(ch);
    }
  }

  // === 6. TAB SWITCHING ===
  // === 6. TAB SWITCHING (REPLACED) ===
  const switchTab = (tabName, title) => {
    // 1. If the user is opening anything EXCEPT Audio, remember it!
    if (tabName !== "audio") {
      lastActiveTab = tabName;
      lastActiveTitle = title;
    }

    // 2. Standard switching logic
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    const target = document.getElementById("content-" + tabName);
    if (target) target.classList.add("active");
    if (inspectorTitle) inspectorTitle.innerText = title;

    // 3. Handle Media Bin
    document
      .querySelectorAll(".bin-context")
      .forEach((b) => b.classList.remove("active"));
    const binTarget =
      document.getElementById("bin-" + tabName) ||
      document.getElementById("bin-overlay");
    if (binTarget) binTarget.classList.add("active");

    // 4. Handle the Layout Expansion
    if (tabName === "audio") {
      bottomArea.classList.add("audio-expanded");
    } else {
      bottomArea.classList.remove("audio-expanded");
    }
  };

  // === 7. SIDEBAR ICON CLICK (TOGGLE FIX) ===
  document.querySelectorAll(".tool-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      const iconText = icon.innerText.trim();
      const isAudio = iconText.includes("🔊");
      const isAlreadyActive = icon.classList.contains("active");

      // THE TOGGLE FIX:
      // If Audio is already open and you click it again...
      if (isAudio && isAlreadyActive) {
        // 1. Go back to the panel saved in our "Memory"
        switchTab(lastActiveTab, lastActiveTitle);

        // 2. Move the blue "active" highlight back to the previous icon
        document.querySelectorAll(".tool-icon").forEach((i) => {
          i.classList.remove("active");
          const t = i.innerText.trim();
          if (t.includes("🔳") && lastActiveTab === "overlay")
            i.classList.add("active");
          if (t.includes("▤") && lastActiveTab === "layouts")
            i.classList.add("active");
          if (t.includes("⛶") && lastActiveTab === "templates")
            i.classList.add("active");
          if (t.includes("T") && lastActiveTab === "text")
            i.classList.add("active");
        });
        return; // Stop here so it doesn't try to "re-open" audio
      }

      // STANDARD SWITCH:
      document
        .querySelectorAll(".tool-icon")
        .forEach((i) => i.classList.remove("active"));
      icon.classList.add("active");

      if (iconText.includes("🔳")) switchTab("overlay", "Overlay / DSK");
      else if (iconText.includes("▤")) switchTab("layouts", "Monitor Layouts");
      else if (iconText.includes("⛶"))
        switchTab("templates", "Scene Templates");
      else if (iconText.includes("T")) switchTab("text", "Text Overlay");
      else if (iconText.includes("🔊")) switchTab("audio", "Audio Mixer");
    });
  });

  // CAMERA GRID CLICK (Selection & Tally)
  cameraGrid?.addEventListener("click", (e) => {
    const settingsBtn = e.target.closest(".cam-settings-trigger");
    const camItem = e.target.closest(".cam-item");

    if (settingsBtn) {
      // 1. CRITICAL: Stop the click from traveling to the 'document'
      e.preventDefault();
      e.stopPropagation();

      const camId = settingsBtn.getAttribute("data-cam");
      const settingsPopup = document.getElementById("cam-settings-popup");
      const settingsTitle = document.getElementById("popup-cam-title");

      if (settingsPopup && settingsTitle) {
        settingsTitle.innerText = `CAM ${camId} SETTINGS`;

        // 2. Open using 'flex' and add 'active' class for your CSS scale(1) transition
        settingsPopup.style.display = "flex";
        settingsPopup.classList.add("active");
      }
      return;
    }
    if (camItem) {
      document
        .querySelectorAll(".cam-item")
        .forEach((c) => c.classList.remove("selected"));
      camItem.classList.add("selected");

      // UI: Tally Progress Bar
      const bar = camItem.querySelector(".progress-bar");
      if (bar) {
        bar.style.transition = "none";
        bar.style.width = "0%";
        void bar.offsetWidth;
        bar.style.transition = "width 10s linear";
        bar.style.width = "100%";
        setTimeout(() => {
          if (camItem.classList.contains("selected"))
            camItem.classList.add("warning");
        }, 7000);
      }

      const camLabel = camItem.querySelector("span");
      if (window.vadaAPI && camLabel) {
        const sourceName = camLabel.innerText.trim();
        window.vadaAPI.startStream(sourceName);
      }
    }
  });

  // === 8. MIXER INTERACTION ===
  mixerContainer?.addEventListener("click", (e) => {
    const channel = e.target.closest(".mixer-channel");
    if (channel && !e.target.closest(".cam-peek-thumb")) {
      channel.classList.toggle("active");
      const btn = channel.querySelector(".mute-btn-vada");
      if (btn) {
        const isActive = channel.classList.contains("active");
        btn.classList.toggle("active", isActive);
      }
    }
  });

  // === 9. JOYSTICK + FINE CONTROLS ===
  document.addEventListener("mousedown", (e) => {
    activeEl = e.target.closest(".fine-handle, #joy-stick");
    if (activeEl) activeEl.style.transition = "none";
  });
  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", () => {
    if (!activeEl) return;
    activeEl.style.transition =
      "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    if (activeEl.id === "joy-stick")
      activeEl.style.transform = "translate(0, 0)";
    else if (activeEl.classList.contains("fine-handle")) {
      activeEl.style.left = "50%";
      activeEl.style.top = "50%";
    }
    activeEl = null;
  });

  // SLIDERS (General)
  [
    "warp-slider",
    "margin-slider",
    "edge-slider",
    "text-opacity-slider",
    "bg-opacity-slider",
    "scroll-speed-slider",
    "master-slider",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", (e) => {
        if (id === "master-slider") globalVolume = e.target.value / 100;
        const fillId = id.replace("-slider", "-fill");
        const fill = document.getElementById(fillId);
        if (fill) fill.style.width = el.value + "%";
      });
    }
  });

  // SIDEBAR POPUP
  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.top = trigger.getBoundingClientRect().top + "px";
    menu.style.left = trigger.getBoundingClientRect().right + 10 + "px";
    menu.classList.toggle("show");
  });

  menu?.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      switchTab(li.dataset.value, li.innerText);
      menu.classList.remove("show");
    });
  });

  // INPUT SELECTOR MENU (Right Click)
  cameraGrid?.addEventListener("contextmenu", (e) => {
    const camItem = e.target.closest(".cam-item");
    if (camItem) {
      e.preventDefault();
      currentTargetSlot = camItem;
      inputMenu.style.display = "block";
      inputMenu.style.top = `${e.clientY}px`;
      inputMenu.style.left = `${e.clientX}px`;
      inputMenu.classList.add("show");
    }
  });

  // === 10. SALRAYWORKS CORE: 4K60P WARP ENGINE CONTROL ===
  const syncWarpEngine = () => {
    const slider = document.getElementById("warp-slider");
    const fill = document.getElementById("warp-fill");
    const tooltip = document.getElementById("warp-tooltip");
    const resetBtn = document.getElementById("reset-warp-btn");

    if (slider) {
      slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);

        // Calculate percentage (Range: -1000 to 1000)
        const pct = ((val + 1000) / 2000) * 100;

        if (tooltip) {
          tooltip.innerText = val;
          tooltip.style.left = pct + "%";
          // Ensure we don't lose the centering transform
          tooltip.style.transform = "translateX(-50%)";
        }
        if (fill) {
          fill.style.width = pct + "%";
        }
        if (window.vadaAPI && window.vadaAPI.updateWarp) {
          window.vadaAPI.updateWarp(val / 1000);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (slider && fill && tooltip) {
          slider.value = 0;
          fill.style.width = "50%";
          tooltip.innerText = "0";
          tooltip.style.left = "50%";
          if (window.vadaAPI && window.vadaAPI.updateWarp)
            window.vadaAPI.updateWarp(0);
        }
      });
    }
  };

  // === 11. SUBMENU CLICK HANDLERS (Hardware, Screen) ===
  document.querySelectorAll(".submenu .menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentTargetSlot) return;

      const parentItem = item.closest(".has-submenu");
      const type = parentItem ? parentItem.dataset.type : "ndi";
      const value = item.dataset.value || item.innerText;
      const name = item.innerText;

      const label = currentTargetSlot.querySelector("span");
      if (label) label.innerText = name;

      document
        .querySelectorAll(".cam-item")
        .forEach((c) => c.classList.remove("selected"));
      currentTargetSlot.classList.add("selected");

      if (window.vadaAPI) {
        if (type === "ndi") window.vadaAPI.startStream(value);
        if (type === "hardware") window.vadaAPI.startHardwareInput(value);
        if (type === "screen") window.vadaAPI.startScreenCapture(value);
      }
      inputMenu.style.display = "none";
    });
  });

  // === 12. MEDIA SELECTION HANDLER ===
  document
    .getElementById("media-trigger")
    ?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!currentTargetSlot) return;

      if (window.vadaAPI && window.vadaAPI.openMediaFile) {
        const filePath = await window.vadaAPI.openMediaFile();
        if (filePath) {
          const fileName = filePath.split(/[\\/]/).pop();
          const label = currentTargetSlot.querySelector("span");
          if (label) label.innerText = fileName;
          document
            .querySelectorAll(".cam-item")
            .forEach((c) => c.classList.remove("selected"));
          currentTargetSlot.classList.add("selected");
        }
      }
      inputMenu.style.display = "none";
    });

  // === UNIVERSAL CLOSING LOGIC ===
  document.addEventListener("click", (e) => {
    const popup = document.getElementById("cam-settings-popup");

    // Check if the popup is currently visible
    const isOpen =
      popup &&
      (popup.style.display === "flex" || popup.classList.contains("active"));

    if (isOpen) {
      const isXButton =
        e.target.closest("#close-settings-btn") ||
        e.target.classList.contains("close-x");
      const isInsidePopup =
        e.target.closest(".vada-inspector-popup") ||
        e.target.closest(".settings-popup");
      const isTrigger = e.target.closest(".cam-settings-trigger");

      // CLOSE IF: We hit the X OR we clicked outside (not inside the popup and not the dots)
      if (isXButton || (!isInsidePopup && !isTrigger)) {
        popup.style.display = "none";
        popup.classList.remove("active");
        console.log("🌑 Settings Closed");
      }
    }

    // Existing logic for other menus (Sidebar/Context)
    if (inputMenu && !e.target.closest(".cam-item")) {
      inputMenu.style.display = "none";
      inputMenu.classList.remove("show");
    }
    if (menu && !e.target.closest("#popup-trigger")) {
      menu.classList.remove("show");
    }
  });

  // NDI DISCOVERY BRIDGE
  if (window.vadaAPI) {
    window.vadaAPI.onNDIUpdate((sources) => {
      if (!ndiList) return;
      ndiList.innerHTML = "";
      if (sources.length === 0) {
        ndiList.innerHTML =
          '<div class="menu-item disabled">Searching for NDI...</div>';
        return;
      }
      sources.forEach((s) => {
        const item = document.createElement("div");
        item.className = "menu-item";
        item.innerText = s.name;
        item.onclick = (e) => {
          e.stopPropagation();
          if (currentTargetSlot) {
            const labelSpan = currentTargetSlot.querySelector("span");
            if (labelSpan) labelSpan.innerText = s.name;
            document
              .querySelectorAll(".cam-item")
              .forEach((c) => c.classList.remove("selected"));
            currentTargetSlot.classList.add("selected");
            window.vadaAPI.startStream(s.name);
            inputMenu.style.display = "none";
          }
        };
        ndiList.appendChild(item);
      });
    });
  }

  const syncStream = (sourceVideo, targetVideoId) => {
    const targetVideo = document.getElementById(targetVideoId);
    if (sourceVideo && sourceVideo.srcObject && targetVideo) {
      targetVideo.srcObject = sourceVideo.srcObject;
      targetVideo.muted = true;
      targetVideo.play().catch((err) => console.error("Switch failed:", err));

      // Hide the placeholder of the parent monitor
      const placeholder =
        targetVideo.parentElement.querySelector(".placeholder-text");
      if (placeholder) placeholder.style.display = "none";
      return true;
    }
    return false;
  };

  // START ENGINES
  syncWarpEngine();
  syncSockets();
  initWebRTC();
  console.log("🎬 All systems operational");
});

// TEST TOOL: Run this in console or add to end of main.js
const injectTestPattern = () => {
    console.log("🧪 Injecting Test Patterns into ALL 8 CAMERAS...");
    
    const createCanvasStream = (text, color) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext("2d");
        let hue = 0;
        
        const draw = () => {
            // Background color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Moving element to prove it's a "live" feed
            hue = (hue + 1) % 360;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fillRect(Math.sin(Date.now()/500) * 100 + 500, 150, 50, 50);

            // Text Labels
            ctx.fillStyle = "white";
            ctx.font = "bold 80px Segoe UI";
            ctx.fillText(text, 100, 350);
            ctx.font = "40px Monospace";
            ctx.fillText(new Date().toLocaleTimeString(), 100, 450);
            requestAnimationFrame(draw);
        };
        draw();
        return canvas.captureStream(30);
    };

    setTimeout(() => {
        // Loop through all 8 possible camera slots
        for (let i = 1; i <= 8; i++) {
            const slot = document.querySelector(`#video-slot-${i}`);
            if (slot) {
                let video = slot.querySelector("video") || document.createElement("video");
                video.autoplay = true;
                video.muted = true;
                video.style.width = "100%"; 
                video.style.height = "100%";
                video.style.objectFit = "cover";

                // Unique color for each camera to distinguish them
                const colors = ["#1a1535", "#351a1a", "#1a351a", "#35351a", "#1a3535", "#351a35", "#050213", "#18152d"];
                video.srcObject = createCanvasStream(`SOURCE CAM ${i}`, colors[i-1]);
                
                if (!slot.querySelector("video")) slot.appendChild(video);
                
                const placeholder = slot.querySelector(".placeholder-text");
                if (placeholder) placeholder.style.display = "none";
            }
        }
    }, 800);
};

injectTestPattern();

// RUN THIS:
injectTestPattern();