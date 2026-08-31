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

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }

    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.3)

    const tubularSegments = Math.max(32, path.points.length * 4)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.12, 8, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: 0.4,
      metalness: 0.05,
      emissive: path.color,
      emissiveIntensity: 0.08,
    })

    return { geometry, material }
  }, [path])

  // Update material live when highlight changes
  if (material) {
    material.emissiveIntensity = isHighlighted ? 0.55 : 0.08
    material.opacity = isHighlighted ? 1 : 0.85
    material.transparent = !isHighlighted
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
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
      scale={isHighlighted ? 1.15 : 1}
    />
  )
}

export function YarnPaths() {
  const yarnPaths = useStore((s) => s.yarnPaths)

  return (
    <group>
      {yarnPaths.map((path) => (
        <TubeYarn key={path.id} path={path} />
      ))}
    </group>
  )
}
