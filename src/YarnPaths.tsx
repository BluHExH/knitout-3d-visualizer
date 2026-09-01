import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, type YarnPath } from './store'

function TubeYarn({ path }: { path: YarnPath }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedLine = useStore((s) => s.selectedLine)
  const selectedYarnId = useStore((s) => s.selectedYarnId)
  const selectedOpIndex = useStore((s) => s.selectedOpIndex)
  const selectYarn = useStore((s) => s.selectYarn)

  const isHighlighted =
    selectedYarnId === path.id ||
    (selectedOpIndex !== null && path.opIndex === selectedOpIndex) ||
    (selectedLine !== null &&
      (path.primaryLine === selectedLine || path.lines.includes(selectedLine)))

  const isTransfer = path.kind === 'transfer'
  const radius = isTransfer ? 0.055 : 0.12

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }

    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.2)
    const tubularSegments = Math.max(16, path.points.length * 3)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 7, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: isTransfer ? 0.3 : 0.42,
      metalness: isTransfer ? 0.35 : 0.04,
      emissive: path.color,
      emissiveIntensity: 0.07,
      transparent: true,
      opacity: isTransfer ? 0.8 : 0.95,
    })

    return { geometry, material }
  }, [path, radius, isTransfer])

  if (material) {
    material.emissiveIntensity = isHighlighted ? 0.7 : isTransfer ? 0.12 : 0.07
    material.opacity = isHighlighted ? 1 : isTransfer ? 0.7 : 0.92
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow={!isTransfer}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        selectYarn(path.id, path.primaryLine)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
      scale={isHighlighted ? 1.25 : 1}
    />
  )
}

function BedGuides() {
  return (
    <group>
      <mesh position={[0, -0.05, -1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.35]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, -0.05, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.35]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.45} />
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
