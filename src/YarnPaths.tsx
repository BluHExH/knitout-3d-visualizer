import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, type YarnPath } from './store'

function TubeYarn({ path }: { path: YarnPath }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedLine = useStore((s) => s.selectedLine)
  const selectedYarnId = useStore((s) => s.selectedYarnId)
  const selectYarn = useStore((s) => s.selectYarn)

  const isHighlighted =
    selectedYarnId === path.id ||
    (selectedLine !== null && path.lines.includes(selectedLine))

  const isTransfer = path.kind === 'transfer'
  const radius = isTransfer ? 0.06 : 0.13

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }

    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.25)

    const tubularSegments = Math.max(24, path.points.length * 3)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: isTransfer ? 0.3 : 0.4,
      metalness: isTransfer ? 0.4 : 0.05,
      emissive: path.color,
      emissiveIntensity: 0.08,
      transparent: isTransfer,
      opacity: isTransfer ? 0.85 : 1,
    })

    return { geometry, material }
  }, [path, radius, isTransfer])

  if (material) {
    material.emissiveIntensity = isHighlighted ? 0.65 : isTransfer ? 0.15 : 0.08
    material.opacity = isHighlighted ? 1 : isTransfer ? 0.75 : 0.9
    material.transparent = true
  }

  const handleClick = (e: any) => {
    e.stopPropagation()
    const line = path.lines[0] ?? null
    selectYarn(path.id, line)
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow={!isTransfer}
      receiveShadow
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
      scale={isHighlighted ? 1.2 : 1}
    />
  )
}

/** Simple visual markers for the two beds */
function BedGuides() {
  return (
    <group>
      <mesh position={[0, -0.05, -1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.35]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, -0.05, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.35]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

export function YarnPaths() {
  const yarnPaths = useStore((s) => s.yarnPaths)

  return (
    <group>
      <BedGuides />
      {yarnPaths.map((path) => (
        <TubeYarn key={path.id} path={path} />
      ))}
    </group>
  )
}
