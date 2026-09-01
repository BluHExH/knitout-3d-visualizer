import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, type YarnPath } from './store'

function TubeYarn({ path }: { path: YarnPath }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedLine = useStore((s) => s.selectedLine)
  const selectedYarnId = useStore((s) => s.selectedYarnId)
  const selectedOpIndex = useStore((s) => s.selectedOpIndex)
  const showUpToOp = useStore((s) => s.showUpToOp)
  const ghostPast = useStore((s) => s.ghostPast)
  const highlightCurrentOnly = useStore((s) => s.highlightCurrentOnly)
  const selectYarn = useStore((s) => s.selectYarn)

  const op = path.opIndex ?? -1
  const isFuture = showUpToOp !== null && op > showUpToOp
  const isPast = showUpToOp !== null && op < showUpToOp
  const isCurrent = selectedOpIndex !== null && op === selectedOpIndex

  if (isFuture) return null

  const isHighlighted =
    selectedYarnId === path.id ||
    isCurrent ||
    (selectedLine !== null &&
      (path.primaryLine === selectedLine || path.lines.includes(selectedLine)))

  const isTransfer = path.kind === 'transfer'
  const isCarrier = path.kind === 'carrier'
  const isGhost = isPast && ghostPast && !isHighlighted

  const radius = isTransfer ? 0.05 : isCarrier ? 0.085 : path.held ? 0.13 : 0.11

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }
    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.25)
    const tubularSegments = Math.max(20, path.points.length * 4)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: isTransfer ? 0.28 : 0.55,
      metalness: isTransfer ? 0.4 : 0.02,
      emissive: path.color,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: isTransfer ? 0.75 : isCarrier ? 0.85 : 0.96,
    })
    return { geometry, material }
  }, [path, radius, isTransfer, isCarrier])

  if (material) {
    if (isGhost) {
      material.opacity = 0.28
      material.emissiveIntensity = 0.02
    } else if (isHighlighted) {
      material.emissiveIntensity = 0.65
      material.opacity = 1
    } else if (highlightCurrentOnly && showUpToOp !== null && !isCurrent) {
      material.opacity = 0.35
      material.emissiveIntensity = 0.03
    } else {
      material.emissiveIntensity = isTransfer ? 0.12 : 0.05
      material.opacity = isTransfer ? 0.75 : isCarrier ? 0.85 : 0.96
    }
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow={!isTransfer && !isGhost}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        selectYarn(path.id, path.primaryLine)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
      scale={isHighlighted ? 1.22 : 1}
    />
  )
}

function BedGuides() {
  return (
    <group>
      <mesh position={[0, -0.05, -1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 0.4]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, -0.05, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 0.4]} />
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
