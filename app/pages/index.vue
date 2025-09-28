<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
gsap.registerPlugin(ScrollTrigger, SplitText)

const scenes = [
  {
    id: 'problem',
    title:
      'The <span class="highlight-text" data-color="#6BA392">UNIABUJA</span> Student Gov Election <br> <em>was crippled.</em>',
    content:
      '<p class="text-xl">Hours of waiting, low trust, fake ballots rampant, and no real transparency. The system doesn\'t work.</p>',
  },
  {
    id: 'solution',
    title:
      'What if <span class="highlight-text" data-color="#1E88A8">SolaVote</span> existed?<br><em>The blockchain-powered voting platform.</em>',
    content:
      `
      <p class="text-xl">Transparent, fast, tamper-proof, and secure voting from anywhere, anytime.</p>
      <p class="text-xl">Only. Possible. On. Solana.</p>
      `,
  },
  {
    id: 'features',
    title: 'Modern <span class="highlight-text" data-color="#6BA392">Features</span> you will love',
    content: `
      <ul class="list-disc pl-6 space-y-3 text-xl">
        <li>Fast and secure voting from anywhere and any device</li>
        <li>AI-powered ID verication to automate the process</li>
        <li>Simple and accessible on-ramping flow</li>
        <li>Blockchain security and provable transparency</li>
        <li>Instant vote tally and public audit logs</li>
      </ul>
    `,
  },
]

const refs = ref<(HTMLElement | null)[]>([])

onMounted(() => {
  refs.value.forEach((sectionEl, i) => {
    if (!sectionEl) return

    // Animate headline (character-level)
    const headline = sectionEl.querySelector('h2')
    if (headline) {
      const splitHeadline = new SplitText(headline, { type: 'chars,words,lines' })
      gsap.from(splitHeadline.chars, {
        opacity: 0,
        y: 80,
        rotateX: -90,
        stagger: 0.03,
        duration: 1,
        ease: 'back.out(2)',
        scrollTrigger: {
          trigger: sectionEl,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        }
      })
    }

    // Animate content (line-level for paragraphs, item-level for lists)
    const content = sectionEl.querySelector('.text-xl, ul')
    if (content) {
      const splitContent = new SplitText(content, { type: 'lines' })
      gsap.from(splitContent.lines, {
        opacity: 0,
        y: 40,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionEl,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        }
      })
    }

    // Highlight animation for colored spans
    const highlightSpans = sectionEl.querySelectorAll('.highlight-text')
    highlightSpans.forEach((span) => {
      const color = span.getAttribute('data-color') || '#6BA392'
      const rect = document.createElement('div')
      rect.className = 'highlight-rect'
      rect.style.backgroundColor = color
      rect.style.opacity = '0.3'
      rect.style.position = 'absolute'
      rect.style.borderRadius = '2px'
      rect.style.zIndex = '-1'
      rect.style.top = '0'
      rect.style.left = '0'
      rect.style.width = '100%'
      rect.style.height = '100%'
      rect.style.transformOrigin = 'left center'

      span.style.position = 'relative'
      span.style.display = 'inline-block'

      const tilt = (Math.random() - 0.5) * 4
      const paddingY = 4 + Math.random() * 4
      const paddingX = 2 + Math.random() * 4

      gsap.set(span, {
        padding: `${paddingY}px ${paddingX}px`,
        margin: `0 -${paddingX}px`,
      })

      span.appendChild(rect)

      // Animate the rectangle and add a subtle pulse
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: span,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        }
      })
      tl.fromTo(rect, { scaleX: 0, rotate: tilt }, { scaleX: 1, duration: 1, ease: 'power2.out' })
       .to(span, { color: '#ffffff', duration: 0.5, yoyo: true, repeat: 1 }, '-=0.5')
       .to(span, { y: -3, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=0.5')
    })
  })
})

const connectWallet = () => {
  window.location.pathname = "/vote-";
}
</script>

<template>
  <div class="min-h-screen overflow-x-hidden py-20 px-8 text-white relative font-manrope">
    <!-- Subtle animated gradient background -->
    <div
      class="fixed inset-0 -z-10 bg-gradient-to-tr from-[#0F172A] via-[#1E3A8A] to-[#065F46] opacity-90 animate-gradient-move"
    ></div>

    <section
      v-for="(scene, index) in scenes"
      :key="index"
      :id="scene.id"
      class="max-w-2xl mx-auto mb-48 relative scroll-mt-40"
    >
      <h2
        class="text-6xl font-extrabold mb-8 leading-tight"
        v-html="scene.title"
        :ref="(el) => (refs[index] = el)"
      ></h2>
      <div v-html="scene.content" class="mb-12"></div>
    </section>

    <!-- Connect Wallet Button -->
    <div class="mt-24 flex justify-center">
      <UButton
        to="/admin-elections"
        class="px-8 py-4 bg-gradient-to-r from-[#6EE7B7] to-[#3B82F6] text-white font-bold text-2xl rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
      >
        Create an Election
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.animate-gradient-move {
  background-size: 200% 200%;
  animation: gradientMove 20s ease infinite;
}
@keyframes gradientMove {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

/* Improved colors for legibility */
.highlight-text {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: white;
  will-change: transform, opacity;
  position: relative;
  line-height: 1.2;
}
.highlight-text[data-color="#6BA392"] {
  color: #6EE7B7;
}
.highlight-text[data-color="#1E88A8"] {
  color: #3B82F6;
}

/* Highlight rectangle styling */
.highlight-rect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  border-radius: 2px;
}
</style>
