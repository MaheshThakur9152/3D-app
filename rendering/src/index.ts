import {
    ViewerApp,
    AssetManagerPlugin,
    SSRPlugin,
    mobileAndTabletCheck,
    GBufferPlugin,
    ProgressivePlugin,
    TonemapPlugin,
    SSAOPlugin,
    GroundPlugin,
    FrameFadePlugin,
    DiamondPlugin,
    BloomPlugin, 
    TemporalAAPlugin, 
    RandomizedDirectionalLightPlugin, 
    AssetImporter, 
    Color
} from "webgi"
import gsap from "gsap"
import "./styles.scss"

import { ModelManifest } from "./cad/ModelManifest"
import { MaterialRoleBinder, GEMSTONE_PRESETS } from "./cad/MaterialRoleBinder"
import { DynamicCadLoader } from "./cad/DynamicCadLoader"
import { CanvasPicker } from "./cad/CanvasPicker"
import { ModelInspector } from "./ui/ModelInspector"
import { UploadModal } from "./ui/UploadModal"
import { RoleMappingModal } from "./ui/RoleMappingModal"
import { autoFrameCamera } from "./cad/CameraFraming"

const LIGHT_BG = new Color('#EEB7B5').convertSRGBToLinear()
const DARK_BG = new Color(0x22052f).convertSRGBToLinear()

// Synthetic manifests for built-in models
const BUILTIN_MANIFEST_RING1: ModelManifest = {
    schemaVersion: '1.0.0',
    modelId: 'builtin-ring-1',
    originalFileName: 'ring_webgi.glb',
    timestamp: new Date().toISOString(),
    units: 'mm',
    boundingDimensions: { width: 2.47, height: 2.64, depth: 1.02, boundingRadius: 1.4 },
    components: [
        { nodeId: 'silver', nodeName: 'silver', sourceLayer: 'Shank', role: 'metal_shank', roleConfidence: 1.0 },
        { nodeId: 'gold', nodeName: 'gold', sourceLayer: 'Head', role: 'metal_head', roleConfidence: 1.0 },
        { nodeId: 'diamonds', nodeName: 'diamonds', sourceLayer: 'Gems', role: 'diamond', roleConfidence: 1.0 },
        { nodeId: 'diamonds001', nodeName: 'diamonds001', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds002', nodeName: 'diamonds002', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds003', nodeName: 'diamonds003', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds004', nodeName: 'diamonds004', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds005', nodeName: 'diamonds005', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
    ]
}

const BUILTIN_MANIFEST_RING2: ModelManifest = {
    schemaVersion: '1.0.0',
    modelId: 'builtin-ring-2',
    originalFileName: 'ring2_webgi.glb',
    timestamp: new Date().toISOString(),
    units: 'mm',
    boundingDimensions: { width: 2.50, height: 2.70, depth: 1.10, boundingRadius: 1.45 },
    components: [
        { nodeId: 'alliance', nodeName: 'alliance', sourceLayer: 'Alliance', role: 'metal_shank', roleConfidence: 1.0 },
        { nodeId: 'entourage', nodeName: 'entourage', sourceLayer: 'Entourage', role: 'metal_head', roleConfidence: 1.0 },
        { nodeId: 'Object', nodeName: 'Object', sourceLayer: 'Diamonds', role: 'diamond', roleConfidence: 1.0 }
    ]
}

async function setupViewer() {
    const canvas = document.getElementById('webgi-canvas') as HTMLCanvasElement
    const viewer = new ViewerApp({
        canvas,
        useGBufferDepth: true,
        isAntialiased: false
    })

    const isMobile = mobileAndTabletCheck()
    viewer.renderer.displayCanvasScaling = Math.min(window.devicePixelRatio, 1)

    const manager = await viewer.addPlugin(AssetManagerPlugin)
    const camera = viewer.scene.activeCamera
    const position = camera.position
    const target = camera.target

    let nightMode = false
    let currentModelTag = "1"

    // Preserved exact 8-pass WebGi rendering pipeline
    await viewer.addPlugin(GBufferPlugin)
    await viewer.addPlugin(new ProgressivePlugin(32))
    await viewer.addPlugin(new TonemapPlugin(true, false,
        [
            `vec4 vignette(vec4 color, vec2 uv, float offset, float darkness){
                uv = ( uv - vec2( 0.5 ) ) * vec2( offset );
                return vec4( mix( color.rgb, vec3( 0.17, 0.00, 0.09 ), dot( uv, uv ) ), color.a );
            }`,
            `gl_FragColor = vignette(gl_FragColor, vUv, 1.1, 0.8);`
        ]
    ))
    const ssr = await viewer.addPlugin(SSRPlugin)
    const ssao = await viewer.addPlugin(SSAOPlugin)
    await viewer.addPlugin(FrameFadePlugin)
    await viewer.addPlugin(GroundPlugin)
    const bloom = await viewer.addPlugin(BloomPlugin)
    await viewer.addPlugin(TemporalAAPlugin)
    await viewer.addPlugin(DiamondPlugin)
    await viewer.addPlugin(RandomizedDirectionalLightPlugin, false)
    viewer.setBackground(LIGHT_BG)

    ssr!.passes.ssr.passObject.lowQualityFrames = 0
    bloom.pass!.passObject.bloomIterations = 2
    ssao.passes.ssao.passObject.material.defines.NUM_SAMPLES = 4

    // Initial camera placement
    position.set(-0.17, -0.25, 8.5)
    target.set(0, 0, 0)

    // WebGi loader progress bar
    const importer = manager.importer as AssetImporter
    importer.addEventListener("onProgress", (ev) => {
        const progressRatio = (ev.loaded / ev.total)
        document.querySelector('.progress')?.setAttribute('style', `transform: scaleX(${progressRatio})`)
    })

    importer.addEventListener("onLoad", () => {
        gsap.to('.loader', { x: '100%', duration: 0.8, ease: "power4.inOut", delay: 0.3 })
    })

    viewer.renderer.refreshPipeline()

    // Initialize CAD integration modules
    const roleBinder = new MaterialRoleBinder(viewer)
    const dynamicLoader = new DynamicCadLoader(viewer, manager, roleBinder)
    const roleModal = new RoleMappingModal(roleBinder)
    const uploadModal = new UploadModal(dynamicLoader, roleModal)

    // Initialize 3D Canvas Picking & Model Hierarchy Inspector
    const canvasPicker = new CanvasPicker(viewer, canvas)
    const modelInspector = new ModelInspector(viewer, roleBinder, canvasPicker)

    // Load initial ring model
    await dynamicLoader.loadModel("./assets/ring_webgi.glb", BUILTIN_MANIFEST_RING1)

    const sceneObjects = viewer.scene.findObjectsByName('Scene')
    const ring = (sceneObjects && sceneObjects[0]) ? sceneObjects[0] as any : viewer.scene.modelRoot as any
    if (ring && ring.rotation) {
        ring.rotation.set(-Math.PI / 2, 0, -Math.PI / 2)
    }

    // Configure camera orbit controls for smooth 60fps interaction
    if (camera.controls) {
        camera.controls.enabled = true
        camera.controls.autoRotate = true
        camera.controls.autoRotateSpeed = 1.0
        camera.controls.minDistance = 2.0
        camera.controls.maxDistance = 16.0
        camera.controls.enablePan = false
        camera.controls.screenSpacePanning = false
        camera.controls.target.set(0, 0, 0)
        camera.controls.update()
    }

    if (isMobile) {
        ssr.passes.ssr.passObject.stepCount /= 2
        bloom.enabled = false
        camera.setCameraOptions({ fov: 65 })
    }

    viewer.renderer.reset()

    let needsUpdate = true
    function onUpdate() {
        needsUpdate = true
    }

    viewer.addEventListener('preFrame', () => {
        if (needsUpdate) {
            camera.positionUpdated(false)
            camera.targetUpdated(true)
            needsUpdate = false
        }
    })

    // UI ELEMENTS - Header Actions
    const btnUpload = document.querySelector('.btn-upload-trigger') as HTMLButtonElement | null
    const btnRoles = document.querySelector('.btn-roles-trigger') as HTMLButtonElement | null
    const btnRotate = document.querySelector('.btn-rotate-toggle') as HTMLButtonElement | null
    const btnTheme = document.querySelector('.btn-theme-toggle') as HTMLButtonElement | null
    const btnAudio = document.querySelector('.btn-audio-toggle') as HTMLButtonElement | null

    // Upload & Role Mapping Handlers
    btnUpload?.addEventListener('click', () => {
        uploadModal.show()
    })

    btnRoles?.addEventListener('click', () => {
        const manifest = dynamicLoader.getCurrentManifest()
        if (manifest) {
            modelInspector.show(manifest)
        }
    })

    // Auto-Rotate Toggle
    if (camera.controls?.autoRotate) {
        btnRotate?.classList.add('active')
    }
    btnRotate?.addEventListener('click', () => {
        if (camera.controls) {
            camera.controls.autoRotate = !camera.controls.autoRotate
            btnRotate.classList.toggle('active', camera.controls.autoRotate)
        }
    })

    // Theme Toggle (Day / Night Studio Lighting)
    btnTheme?.addEventListener('click', () => {
        nightMode = !nightMode
        document.body.classList.toggle('night-mode', nightMode)
        btnTheme.classList.toggle('active', nightMode)
        viewer.setBackground(nightMode ? DARK_BG : LIGHT_BG)
        viewer.renderer.reset()
    })

    // Background Audio Loop
    const audio = new Audio('./assets/sounds/music_loop.mp3')
    audio.loop = true
    audio.volume = 0.15
    let audioPlaying = false

    btnAudio?.addEventListener('click', () => {
        if (!audioPlaying) {
            audio.play().then(() => {
                audioPlaying = true
                btnAudio.classList.add('active')
            }).catch(() => {})
        } else {
            audio.pause()
            audioPlaying = false
            btnAudio.classList.remove('active')
        }
    })

    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-btn')
    const panels = document.querySelectorAll('.panel-content')

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab')
            if (!targetTab) return

            tabButtons.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')

            panels.forEach(p => {
                p.classList.toggle('active', p.id === `panel-${targetTab}`)
            })

            // Camera behavior on tab change
            const currentManifest = dynamicLoader.getCurrentManifest()
            const radius = currentManifest?.boundingDimensions ? currentManifest.boundingDimensions.boundingRadius : 1.35

            if (targetTab === 'gems') {
                // Macro zoom to gemstone facets
                const zoomDist = Math.max(1.5, radius * 1.8)
                gsap.killTweensOf(position)
                gsap.killTweensOf(target)

                const prevAutoRotate = camera.controls?.autoRotate
                if (camera.controls) camera.controls.autoRotate = false

                gsap.to(position, {
                    x: 1.6 * (zoomDist / 3.0),
                    y: 3.66 * (zoomDist / 3.0),
                    z: 2.55 * (zoomDist / 3.0),
                    duration: 1.2,
                    ease: "power2.inOut",
                    onUpdate: () => {
                        camera.positionUpdated(true)
                        camera.targetUpdated(true)
                        onUpdate()
                    },
                    onComplete: () => {
                        if (camera.controls) {
                            camera.controls.autoRotate = prevAutoRotate
                            camera.controls.update()
                        }
                    }
                })

                gsap.to(target, {
                    x: isMobile ? 0 : -0.01,
                    y: isMobile ? 0.5 : 0.89,
                    z: -0.09,
                    duration: 1.2,
                    ease: "power2.inOut"
                })
            } else {
                // Return to whole-ring framing
                autoFrameCamera(camera, camera.controls, radius, true, onUpdate)
            }
        })
    })

    // Metal Material Swatches
    const metalMap: Record<string, [number, number]> = {
        'default': [0xfea04d, 0xffffff],
        'gold-gold': [0xfea04d, 0xfea04d],
        'silver-silver': [0xffffff, 0xffffff],
        'rose-rose': [0xfa8787, 0xfa8787],
        'silver-gold': [0xffffff, 0xfea04d],
        'rose-silver': [0xfa8787, 0xffffff],
        'gold-rose': [0xfea04d, 0xfa8787]
    }

    const metalSwatches = document.querySelectorAll('#panel-metals .swatch-item')
    metalSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const metalKey = swatch.getAttribute('data-metal')
            if (!metalKey || !metalMap[metalKey]) return

            metalSwatches.forEach(s => s.classList.remove('active'))
            swatch.classList.add('active')

            const [col1, col2] = metalMap[metalKey]
            roleBinder.setMetalColors(new Color(col1), new Color(col2))
        })
    })

    // Gemstone Swatches
    const gemSwatches = document.querySelectorAll('#panel-gems .swatch-item')
    gemSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const presetKey = swatch.getAttribute('data-gem-preset') || 'diamond'
            const preset = GEMSTONE_PRESETS[presetKey] || GEMSTONE_PRESETS.diamond

            gemSwatches.forEach(s => s.classList.remove('active'))
            swatch.classList.add('active')

            roleBinder.setGemstoneAppearance(preset, 'all')
        })
    })

    // Model Switching (Design Badges)
    let customModelUrl: string | null = null
    let customModelManifest: ModelManifest | null = null

    const modelBadges = document.querySelectorAll('.model-badge')
    const customBadge = document.querySelector('.model-custom-badge') as HTMLElement | null
    const customTitle = document.querySelector('.custom-model-name') as HTMLElement | null

    function setActiveModelBadge(tag: string) {
        currentModelTag = tag
        modelBadges.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-model') === tag)
        })
    }

    modelBadges.forEach(badge => {
        badge.addEventListener('click', async () => {
            const modelTag = badge.getAttribute('data-model')
            if (!modelTag || modelTag === currentModelTag) return

            canvasPicker.clearSelection()

            if (modelTag === '1') {
                setActiveModelBadge('1')
                await transitionLoadModel('./assets/ring_webgi.glb', BUILTIN_MANIFEST_RING1, true)
            } else if (modelTag === '2') {
                setActiveModelBadge('2')
                await transitionLoadModel('./assets/ring2_webgi.glb', BUILTIN_MANIFEST_RING2, false)
            } else if (modelTag === 'custom' && customModelUrl && customModelManifest) {
                setActiveModelBadge('custom')
                await transitionLoadModel(customModelUrl, customModelManifest, false)
            }
        })
    })

    async function transitionLoadModel(url: string, manifest: ModelManifest, applyRotation: boolean) {
        const bg = nightMode ? DARK_BG : LIGHT_BG
        canvasPicker.clearSelection()

        gsap.to('.loader', {
            x: '0%',
            duration: 0.4,
            ease: "power3.inOut",
            onComplete: async () => {
                await dynamicLoader.loadModel(url, manifest)
                if (applyRotation) {
                    const sc = viewer.scene.findObjectsByName('Scene')
                    const r = (sc && sc[0]) ? sc[0] as any : viewer.scene.modelRoot as any
                    if (r && r.rotation) r.rotation.set(-Math.PI / 2, 0, -Math.PI / 2)
                }
                viewer.setBackground(bg)
                gsap.to('.loader', { x: '100%', duration: 0.5, ease: "power3.inOut", delay: 0.2 })
            }
        })
    }

    // Connect UploadModal callback to dynamically expose custom ring
    uploadModal.onModelUploaded((manifest: ModelManifest, glbUrl: string) => {
        customModelUrl = glbUrl
        customModelManifest = manifest

        if (customBadge) {
            customBadge.style.display = 'flex'
        }
        if (customTitle) {
            customTitle.textContent = manifest.originalFileName || "Uploaded Ring"
        }
        setActiveModelBadge('custom')

        if (btnRoles) {
            btnRoles.style.display = 'flex'
        }
    })

    // Check if server already has a processed model available (e.g. from previous upload session)
    try {
        const serverCheck = await fetch('http://localhost:5000/api/v1/models/6926ff82-eb91-4f69-97ab-0de74b9771fb/manifest')
        if (serverCheck.ok) {
            const uploadedManifest = await serverCheck.json()
            customModelManifest = uploadedManifest
            customModelUrl = 'http://localhost:5000/api/v1/models/6926ff82-eb91-4f69-97ab-0de74b9771fb/model.glb'

            if (customBadge) {
                customBadge.style.display = 'flex'
            }
            if (customTitle) {
                customTitle.textContent = uploadedManifest.originalFileName || "Uploaded Ring"
            }
            if (btnRoles) {
                btnRoles.style.display = 'flex'
            }
        }
    } catch {
        // Server check optional fallback
    }
}

setupViewer()
