const year = document.querySelector("#year");
const toast = document.querySelector(".toast");
const copyEmailButton = document.querySelector(".copy-email");
const backToTopButton = document.querySelector(".back-to-top");
const heroVideo = document.querySelector(".video-frame video");
const videoSoundToggle = document.querySelector(".video-sound-toggle");
const videoFullscreenTriggers = [...document.querySelectorAll(".video-fullscreen-trigger")];
const videoLightbox = document.querySelector("[data-video-lightbox]");
const videoLightboxVideo = videoLightbox?.querySelector("video");
const videoLightboxClose = videoLightbox?.querySelector(".video-lightbox-close");
const contactModalTriggers = [...document.querySelectorAll(".contact-modal-trigger")];
const lineDialog = document.querySelector("#lineDialog");
const dialogClose = document.querySelector(".dialog-close");
const siteNav = document.querySelector(".site-nav");
const navIndicator = document.querySelector(".nav-indicator");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
let currentActiveSectionId = "";
let navScrollWasAutomatic = false;
let navScrollTimeout;
let navUserInteracting = false;
let navUserInteractionTimeout;
let scrollAnimationFrame;
let scrollStateFrame;

year.textContent = new Date().getFullYear();

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
};

const moveNavIndicator = (activeLink) => {
  if (!siteNav || !navIndicator || !activeLink) return;

  const navRect = siteNav.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  const indicatorX = linkRect.left - navRect.left + siteNav.scrollLeft - 5;

  siteNav.style.setProperty("--nav-indicator-x", `${indicatorX}px`);
  siteNav.style.setProperty("--nav-indicator-width", `${linkRect.width}px`);
  siteNav.style.setProperty("--nav-indicator-opacity", "1");
};

const setActiveNavLink = (sectionId, options = {}) => {
  const { centerNav = false, force = false } = options;

  if (!force && currentActiveSectionId === sectionId) return;

  const activeLink = navLinks.find((link) => link.getAttribute("href") === `#${sectionId}`);

  currentActiveSectionId = sectionId;

  navLinks.forEach((link) => {
    link.classList.toggle("active", link === activeLink);
  });

  if (!activeLink) {
    siteNav?.style.setProperty("--nav-indicator-opacity", "0");
    return;
  }

  moveNavIndicator(activeLink);

  if (centerNav) {
    navScrollWasAutomatic = true;
    activeLink.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    window.clearTimeout(navScrollTimeout);
    navScrollTimeout = window.setTimeout(() => {
      navScrollWasAutomatic = false;
    }, 520);
  }
};

const getCenteredNavLink = () => {
  if (!siteNav || navLinks.length === 0) return null;

  const navRect = siteNav.getBoundingClientRect();
  const navCenter = navRect.left + navRect.width / 2;

  return navLinks.reduce((closest, link) => {
    const linkRect = link.getBoundingClientRect();
    const distance = Math.abs(linkRect.left + linkRect.width / 2 - navCenter);

    return !closest || distance < closest.distance ? { link, distance } : closest;
  }, null)?.link;
};

document.querySelectorAll("[data-placeholder]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("作品連結尚未放入，之後可替換成實際網址。");
  });
});

const smoothScrollTo = (target) => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const headerOffset = 78;
  const startY = window.scrollY;
  const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset);
  const distance = targetY - startY;
  const duration = Math.min(950, Math.max(460, Math.abs(distance) * 0.42));
  const startedAt = performance.now();
  const easeOutQuart = (time) => 1 - Math.pow(1 - time, 4);

  window.cancelAnimationFrame(scrollAnimationFrame);

  if (prefersReducedMotion) {
    window.scrollTo(0, targetY);
    return;
  }

  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    window.scrollTo(0, startY + distance * easeOutQuart(progress));

    if (progress < 1) {
      scrollAnimationFrame = requestAnimationFrame(step);
    }
  };

  scrollAnimationFrame = requestAnimationFrame(step);
};

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));

    if (!target) return;

    event.preventDefault();
    smoothScrollTo(target);
    setActiveNavLink(target.id, { centerNav: true });
    history.replaceState(null, "", link.getAttribute("href"));
  });
});

if (siteNav) {
  let navSlideTimer;

  const markNavUserInteraction = () => {
    navUserInteracting = true;
    window.clearTimeout(navUserInteractionTimeout);
    navUserInteractionTimeout = window.setTimeout(() => {
      navUserInteracting = false;
    }, 420);
  };

  siteNav.addEventListener("pointerdown", markNavUserInteraction);
  siteNav.addEventListener("touchstart", markNavUserInteraction, { passive: true });

  siteNav.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (siteNav.scrollWidth <= siteNav.clientWidth) return;

      markNavUserInteraction();
      event.preventDefault();
      siteNav.scrollLeft += event.deltaY;
    },
    { passive: false },
  );

  siteNav.addEventListener("scroll", () => {
    const activeLink = navLinks.find((link) => link.classList.contains("active"));
    const centeredLink = getCenteredNavLink();

    moveNavIndicator(navScrollWasAutomatic ? activeLink : centeredLink);

    if (navScrollWasAutomatic || !navUserInteracting || !centeredLink) return;

    window.clearTimeout(navSlideTimer);
    navSlideTimer = window.setTimeout(() => {
      const target = document.querySelector(centeredLink.getAttribute("href"));

      if (!target) return;

      setActiveNavLink(target.id, { centerNav: false });
      smoothScrollTo(target);
      history.replaceState(null, "", centeredLink.getAttribute("href"));
    }, 260);
  });
}

if (heroVideo && videoSoundToggle) {
  videoSoundToggle.addEventListener("click", async () => {
    heroVideo.muted = !heroVideo.muted;

    if (!heroVideo.muted) {
      heroVideo.volume = 1;
      try {
        await heroVideo.play();
      } catch {
        heroVideo.muted = true;
        showToast("瀏覽器暫時無法開啟影片聲音。");
      }
    }

    videoSoundToggle.textContent = heroVideo.muted ? "聲音開啟" : "關閉聲音";
    videoSoundToggle.setAttribute(
      "aria-label",
      heroVideo.muted ? "開啟影片聲音" : "關閉影片聲音",
    );
  });
}

if (videoLightbox && videoLightboxVideo && videoFullscreenTriggers.length > 0) {
  let touchStartY = 0;
  let touchDeltaY = 0;

  const closeVideoLightbox = () => {
    videoLightboxVideo.pause();
    videoLightboxVideo.currentTime = 0;
    videoLightbox.hidden = true;
    videoLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("video-lightbox-open");
    if (heroVideo) heroVideo.play().catch(() => {});
  };

  const openVideoLightbox = async () => {
    heroVideo?.pause();
    videoLightbox.hidden = false;
    videoLightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("video-lightbox-open");
    videoLightboxVideo.currentTime = 0;
    videoLightboxVideo.muted = false;
    videoLightboxVideo.volume = 1;

    try {
      await videoLightboxVideo.play();
    } catch {
      videoLightboxVideo.muted = true;
      await videoLightboxVideo.play().catch(() => {});
    }
  };

  videoFullscreenTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      openVideoLightbox();
    });
  });

  videoLightboxClose?.addEventListener("click", closeVideoLightbox);

  videoLightbox.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0].clientY;
    touchDeltaY = 0;
  }, { passive: true });

  videoLightbox.addEventListener("touchmove", (event) => {
    touchDeltaY = event.touches[0].clientY - touchStartY;
  }, { passive: true });

  videoLightbox.addEventListener("touchend", () => {
    if (touchDeltaY > 90) closeVideoLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !videoLightbox.hidden) {
      closeVideoLightbox();
    }
  });
}

if (contactModalTriggers.length > 0 && lineDialog) {
  contactModalTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      lineDialog.showModal();
    });
  });
}

if (dialogClose && lineDialog) {
  dialogClose.addEventListener("click", () => {
    lineDialog.close();
  });

  lineDialog.addEventListener("click", (event) => {
    if (event.target === lineDialog) {
      lineDialog.close();
    }
  });
}

copyEmailButton.addEventListener("click", async () => {
  const email = copyEmailButton.dataset.email;

  try {
    await navigator.clipboard.writeText(email);
    showToast("Email 已複製。");
  } catch {
    showToast("可直接寄信到 wwd10925@gmail.com。");
  }
});

backToTopButton.addEventListener("click", () => {
  smoothScrollTo(document.querySelector("#top"));
});

document.querySelectorAll("[data-work-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const cards = [...carousel.querySelectorAll(".work-card")];
  const previousButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  const currentLabel = carousel.querySelector("[data-carousel-current]");
  let carouselFrame;

  if (!track || cards.length === 0) return;

  const getCurrentIndex = () => {
    const trackLeft = track.getBoundingClientRect().left;

    return cards.reduce(
      (closest, card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left - trackLeft);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
  };

  const updateCarouselState = () => {
    const index = getCurrentIndex();
    if (currentLabel) currentLabel.textContent = String(index + 1).padStart(2, "0");
  };

  const moveToCard = (direction) => {
    const nextIndex = (getCurrentIndex() + direction + cards.length) % cards.length;
    track.scrollTo({
      left: cards[nextIndex].offsetLeft - track.offsetLeft,
      behavior: "smooth",
    });
  };

  previousButton?.addEventListener("click", () => moveToCard(-1));
  nextButton?.addEventListener("click", () => moveToCard(1));

  track.addEventListener(
    "scroll",
    () => {
      if (carouselFrame) return;

      carouselFrame = requestAnimationFrame(() => {
        updateCarouselState();
        carouselFrame = null;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", updateCarouselState);
  updateCarouselState();
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 },
);

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

const navObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    setActiveNavLink(visible.target.id);
  },
  {
    rootMargin: "-35% 0px -55% 0px",
    threshold: [0.05, 0.25, 0.5],
  },
);

sections.forEach((section) => {
  navObserver.observe(section);
});

const updateScrollState = () => {
  if (scrollStateFrame) return;

  scrollStateFrame = requestAnimationFrame(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

    document.body.style.setProperty("--scroll-progress", Math.min(progress, 1).toString());
    backToTopButton.classList.toggle("visible", window.scrollY > 560);
    scrollStateFrame = null;
  });
};

window.addEventListener("scroll", updateScrollState, { passive: true });
window.addEventListener("resize", () => {
  const activeLink = navLinks.find((link) => link.classList.contains("active"));
  moveNavIndicator(activeLink);
});
updateScrollState();

if (location.hash) {
  setActiveNavLink(location.hash.replace("#", ""), { centerNav: true, force: true });
}
