import THREE, { Mesh, FileLoader } from 'three'

import { MinecraftModelGeometry } from './geometry'
import { AbstractLoader, OnProgress, OnError } from './loader'
import { MinecraftModelMaterial } from './material'
import { MinecraftModel, isMinecraftModel } from './model'
import { MinecraftTexture } from './texture'
import { PlainAnimator } from 'three-plain-animator'

type MaterialMapping = { [path: string]: MinecraftModelMaterial }

export class MinecraftModelMesh extends Mesh {
  private materialMapping: MaterialMapping
  private animator: PlainAnimator | null;

  constructor (model: MinecraftModel | string | any, tint?: number) {
    if (typeof model === 'string') {
      model = JSON.parse(model)
    }

    if (!isMinecraftModel(model)) {
      throw new Error('Invalid model')
    }

    const geometry = new MinecraftModelGeometry(model)

    const sortedTextures = [...new Set(Object.values(model.textures))].sort()
    const mapping: MaterialMapping = {}
    const materials = sortedTextures.map((path, index) => {
      return mapping[path] = new MinecraftModelMaterial(undefined, geometry.faceHasTint(index) ? tint : undefined);
    })

    super(geometry, [new MinecraftModelMaterial(), ...materials])

    this.materialMapping = mapping
    this.animator = null;
  }

  public async resolveTextures (resolver: (path: string) => ((MinecraftTexture | null) | Promise<(MinecraftTexture | null)>)) {
    for (const path in this.materialMapping) {
      let texture: MinecraftTexture | null = null;
      try {
        texture = await resolver(path);
      } catch (err) {
        console.warn(`Failed to resolve texture '${path}': ${err}`)
        this.materialMapping[path].map = null;
        continue;
      }

      if (!texture) {
        this.materialMapping[path].map = null;
        continue;
      }

      texture.encoding = THREE.sRGBEncoding;
      texture.magFilter = THREE.NearestFilter;

      // Check if this texture is likely animated
      if (!texture.image) {
        this.materialMapping[path].map = texture;
        continue;
      }

      const animFrames = texture.image.height / texture.image.width;
      const isAnimated = Number.isInteger(animFrames) && animFrames > 1;

      if (!isAnimated) {
        this.materialMapping[path].map = texture;
        continue;
      }

      // Animated texture
      this.animator = new PlainAnimator(texture.clone(), 1, animFrames, animFrames, 10);
      const animTexture = this.animator.init();
      this.materialMapping[path].map = animTexture;
    }
  }

  public animate() {
    if (this.animator) this.animator.animate();
  }
}

type OnLoad = (mesh: MinecraftModelMesh) => void

export class MinecraftModelLoader extends AbstractLoader {
  public load (url: string, onLoad?: OnLoad, onProgress?: OnProgress, onError?: OnError) {
    const loader = new FileLoader(this.manager)
    loader.setPath(this.path)
    loader.setResponseType('json')

    const handleLoad = (model: any) => {
      try {
        const mesh = new MinecraftModelMesh(model)

        if (onLoad) {
          onLoad(mesh)
        }
      } catch (err) {
        if (onError) {
          onError(err)
        }
      }
    }

    loader.load(url, handleLoad, onProgress, onError)
  }

  public loadAsync(url: string): Promise<MinecraftModelMesh> {
    return new Promise((resolve, reject) => {
      this.load(url, resolve, undefined, reject);
    })
  }
}
