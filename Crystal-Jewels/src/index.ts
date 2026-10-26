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
    BufferGeometry,
    MeshStandardMaterial2,
    BloomPlugin, 
    TemporalAAPlugin, 
    RandomizedDirectionalLightPlugin, 
    AssetImporter, 
    Color, 
    Mesh
} from "webgi"
import gsap from "gsap"
import "./styles.scss"

const diamondsObjectNames = [
    'diamonds',
    'diamonds001',
    'diamonds002',
    'diamonds003',
    'diamonds004',
    'diamonds005',
]

const diamondsObjectNames2 = [
    'Object'
]

const DARK_BG = new Color(0x22052f).convertSRGBToLinear()

async function setupViewer(){
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

    // Interface Elements
    const gemMenu = document.querySelector('.gem--menu') as HTMLElement
    const materialsMenu = document.querySelector('.materials--menu') as HTMLElement
    const configMaterial = document.querySelector('.config--material') as HTMLElement
    const configGem = document.querySelector('.config--gem') as HTMLElement
    const closeConfigMaterial = document.querySelector('.close-materials') as HTMLElement
    const configRing = document.querySelector('.config--ring') as HTMLElement
    const closeConfigGem = document.querySelector('.close-gems') as HTMLElement
    let ringModel = 1

    // Add WEBGi plugins
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
    viewer.setBackground(DARK_BG)

    ssr!.passes.ssr.passObject.lowQualityFrames = 0
    bloom.pass!.passObject.bloomIterations = 2
    ssao.passes.ssao.passObject.material.defines.NUM_SAMPLES = 4

    // Initial camera position for configurator
    position.set(-0.17, -0.25, 8.5)
    target.set(0, 0, 0)

    // WEBGi loader
    const importer = manager.importer as AssetImporter

    importer.addEventListener("onProgress", (ev) => {
        const progressRatio = (ev.loaded / ev.total)
        document.querySelector('.progress')?.setAttribute('style', `transform: scaleX(${progressRatio})`)
    })

    importer.addEventListener("onLoad", () => {
        gsap.to('.loader', {x: '100%', duration: 0.8, ease: "power4.inOut", delay: 0.5})
    })

    viewer.renderer.refreshPipeline()

    // Load initial model
    await manager.addFromPath("./assets/ring_webgi.glb")

    let ring: Mesh<BufferGeometry, MeshStandardMaterial2>
    let gold: Mesh<BufferGeometry, MeshStandardMaterial2>
    let silver: Mesh<BufferGeometry, MeshStandardMaterial2>
    let diamondObjects: any[] = []

    ring = viewer.scene.findObjectsByName('Scene')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
    silver = viewer.scene.findObjectsByName('silver')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
    gold = viewer.scene.findObjectsByName('gold')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
    ring.rotation.set(-Math.PI / 2, 0, -Math.PI / 2)

    for (const obj of diamondsObjectNames) {
        const o = viewer.scene.findObjectsByName(obj)[0]
        diamondObjects.push(o)
    }

    if (camera.controls) {
        camera.controls.enabled = true
        camera.controls.autoRotate = true
        camera.controls.minDistance = 5
        camera.controls.maxDistance = 13
        camera.controls.enablePan = false
        camera.controls.screenSpacePanning = false
    }

    if (isMobile) {
        ssr.passes.ssr.passObject.stepCount /= 2
        bloom.enabled = false
        camera.setCameraOptions({fov: 65})
    }

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

    // GEM MENU
    configGem.addEventListener('click', () => {
        gemMenu.classList.add('show')
        materialsMenu.classList.remove('show')

        gsap.timeline()
            .to(position, {x: 1.6, y: 3.66, z: 2.55, duration: 1.5, onUpdate})
            .to(target, {x: isMobile ? 0 : -0.01, y: isMobile ? 0.5 : 0.89, z: -0.09, duration: 1.5}, '-=1.5')

        document.querySelector('.footer--menu li.active')?.classList.remove('active')
        configGem.parentElement?.classList.add('active')
    })

    function changeDiamondColor(_gemColor: Color) {
        for (const o of diamondObjects) {
            o.material.color = _gemColor
        }
    }

    const gemColorMap: Record<string, string> = {
        ruby: '#f70db1',
        faint: '#CFECEC',
        fancy: '#a9cbe2',
        aqua: '#62cffe',
        swiss: '#76dce4',
        yellow: '#efe75b',
        orange: '#eb8e17',
        green: '#17ebb5',
        emerald: '#5eca00',
        rose: '#fa37d7',
        violet: '#c200f2'
    }

    for (const [key, hex] of Object.entries(gemColorMap)) {
        document.querySelector(`.${key}`)?.addEventListener('click', () => {
            changeDiamondColor(new Color(hex))
            document.querySelector('.colors--list li.active')?.classList.remove('active')
            document.querySelector(`.${key}`)?.classList.add('active')
        })
    }

    closeConfigGem.addEventListener('click', () => {
        gemMenu.classList.remove('show')
        gsap.timeline()
            .to(position, {x: -0.17, y: -0.25, z: 8.5, duration: 2.5, onUpdate})
            .to(target, {x: 0, y: 0, z: 0, duration: 2.5, onUpdate}, '-=2.5')

        document.querySelector('.footer--menu li.active')?.classList.remove('active')
    })

    // MATERIALS MENU
    configMaterial.addEventListener('click', () => {
        materialsMenu.classList.add('show')
        gemMenu.classList.remove('show')
        gsap.timeline()
            .to(position, {x: -0.17, y: -0.25, z: 8.5, duration: 2.5, onUpdate})
            .to(target, {x: 0, y: 0, z: 0, duration: 2.5, onUpdate}, '-=2.5')

        document.querySelector('.footer--menu li.active')?.classList.remove('active')
        configMaterial.parentElement?.classList.add('active')
    })

    function changeMaterialColor(_firstColor: Color, _secondColor: Color) {
        silver.material.color = _firstColor
        gold.material.color = _secondColor
    }

    const materialMap: Record<string, [number, number]> = {
        default: [0xfea04d, 0xffffff],
        'silver-gold': [0xffffff, 0xfea04d],
        'silver-silver': [0xffffff, 0xffffff],
        'gold-gold': [0xfea04d, 0xfea04d],
        'rose-silver': [0xfa8787, 0xffffff],
        'gold-rose': [0xfea04d, 0xfa8787],
        'rose-rose': [0xfa8787, 0xfa8787]
    }

    for (const [key, [col1, col2]] of Object.entries(materialMap)) {
        document.querySelector(`.${key}`)?.addEventListener('click', () => {
            changeMaterialColor(new Color(col1), new Color(col2))
            document.querySelector('.materials--list li.active')?.classList.remove('active')
            document.querySelector(`.${key}`)?.classList.add('active')
        })
    }

    closeConfigMaterial.addEventListener('click', () => {
        materialsMenu.classList.remove('show')
        document.querySelector('.footer--menu li.active')?.classList.remove('active')
    })

    // CHANGE RING MODEL
    configRing.addEventListener('click', () => {
        gsap.to('.loader', {
            x: '0%',
            duration: 0.8,
            ease: "power4.inOut",
            onComplete: () => {
                loadNewModel()
            }
        })
        document.querySelector('.footer--menu li.active')?.classList.remove('active')
    })

    async function loadNewModel() {
        viewer.scene.removeSceneModels()
        diamondObjects.length = 0

        if (ringModel == 1) {
            await manager.addFromPath("./assets/ring2_webgi.glb")
            gsap.to('.loader', {x: '100%', duration: 0.8, ease: "power4.inOut", delay: 1})
            viewer.setBackground(DARK_BG)

            ring = viewer.scene.findObjectsByName('Scene_1')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
            silver = viewer.scene.findObjectsByName('alliance')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
            gold = viewer.scene.findObjectsByName('entourage')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>

            for (const obj of diamondsObjectNames2) {
                const o = viewer.scene.findObjectsByName(obj)[0]
                diamondObjects.push(o)
            }
            ringModel = 2
        } else {
            await manager.addFromPath("./assets/ring_webgi.glb")
            gsap.to('.loader', {x: '100%', duration: 0.8, ease: "power4.inOut", delay: 1})
            viewer.setBackground(DARK_BG)

            ring = viewer.scene.findObjectsByName('Scene')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
            silver = viewer.scene.findObjectsByName('silver')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
            gold = viewer.scene.findObjectsByName('gold')[0] as any as Mesh<BufferGeometry, MeshStandardMaterial2>
            ring.rotation.set(-Math.PI / 2, 0, 0)

            for (const obj of diamondsObjectNames) {
                const o = viewer.scene.findObjectsByName(obj)[0]
                diamondObjects.push(o)
            }
            ringModel = 1
        }

        if (camera.controls) {
            camera.controls.autoRotate = true
            camera.controls.minDistance = 5
            camera.controls.maxDistance = 13
            camera.controls.enablePan = false
            camera.controls.screenSpacePanning = false
        }
    }
}

// Background Music
const audio = new Audio()
audio.src = './assets/sounds/music_loop.mp3'
let musicPlay = false

function playMusic() {
    if (!musicPlay) {
        audio.play()
        audio.volume = 0.1
        audio.loop = true
        musicPlay = true
    } else {
        audio.pause()
        musicPlay = false
    }
}

document.querySelector('.music--control--2')?.addEventListener('click', () => {
    playMusic()
})

setupViewer()
