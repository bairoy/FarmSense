import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { Colors, FontFamily, Palette, Radius, Spacing } from "@/constants/theme";

const TILE = 256;
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 17;
const GRID = 2;
const PINCH_STEP = 1.4;

type Layer = "satellite" | "street";

const LAYERS: Record<
  Layer,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; base: (z: number, x: number, y: number) => string; labels?: (z: number, x: number, y: number) => string; attribution: string }
> = {
  satellite: {
    label: "Satellite",
    icon: "satellite-variant",
    base: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    labels: (z, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
    attribution: "Imagery © Esri",
  },
  street: {
    label: "Map",
    icon: "map-outline",
    base: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap",
  },
};

const worldSize = (zoom: number) => TILE * 2 ** zoom;

const toWorld = (lat: number, lon: number, zoom: number) => {
  const size = worldSize(zoom);
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  };
};

const toLatLon = (x: number, y: number, zoom: number) => {
  const size = worldSize(zoom);
  const lon = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  return { latitude: (Math.atan(Math.sinh(n)) * 180) / Math.PI, longitude: lon };
};

interface TileMapProps {
  latitude: number;
  longitude: number;
  height: number;
  /** Called with the pin's location after the farmer finishes dragging the map. */
  onChange?: (coords: { latitude: number; longitude: number }) => void;
}

/**
 * Pin-based location picker drawn from ordinary map tiles, so nothing depends on
 * the native map view. The pin stays in the middle; drag the map under it, zoom
 * with + and -, and switch between satellite and a street map that shows village
 * and road names.
 */
export function TileMap({ latitude, longitude, height, onChange }: TileMapProps) {
  const [center, setCenter] = useState({ latitude, longitude });
  const [source, setSource] = useState({ latitude, longitude });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [layer, setLayer] = useState<Layer>("satellite");
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  if (source.latitude !== latitude || source.longitude !== longitude) {
    setSource({ latitude, longitude });
    setCenter({ latitude, longitude });
  }

  const base = toWorld(center.latitude, center.longitude, zoom);
  const x = base.x - (drag?.dx ?? 0);
  const y = base.y - (drag?.dy ?? 0);

  const [pinch, setPinch] = useState<{ dist: number } | null>(null);
  const [pinched, setPinched] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, g) =>
      evt.nativeEvent.touches.length >= 2 || Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
    onPanResponderMove: (evt, g) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length >= 2) {
        // Two fingers: zoom around the pin rather than dragging the map.
        const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        setPinched(true);
        setDrag(null);
        if (!pinch) {
          setPinch({ dist });
          return;
        }
        const ratio = dist / pinch.dist;
        if (ratio > PINCH_STEP && zoom < MAX_ZOOM) {
          setZoom((z) => Math.min(MAX_ZOOM, z + 1));
          setPinch({ dist });
        } else if (ratio < 1 / PINCH_STEP && zoom > MIN_ZOOM) {
          setZoom((z) => Math.max(MIN_ZOOM, z - 1));
          setPinch({ dist });
        }
        return;
      }
      if (!pinched) setDrag({ dx: g.dx, dy: g.dy });
    },
    onPanResponderRelease: (_, g) => {
      setPinch(null);
      if (pinched) {
        setPinched(false);
        setDrag(null);
        return;
      }
      const next = toLatLon(base.x - g.dx, base.y - g.dy, zoom);
      setCenter(next);
      setDrag(null);
      onChange?.(next);
    },
    onPanResponderTerminate: () => {
      setPinch(null);
      setPinched(false);
      setDrag(null);
    },
  });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const tilesPerSide = 2 ** zoom;
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  const tiles: React.ReactNode[] = [];

  if (width > 0) {
    for (let dy = -GRID; dy <= GRID; dy++) {
      for (let dx = -GRID; dx <= GRID; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (ty < 0 || ty >= tilesPerSide) continue;
        const wrappedX = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;
        const style = {
          position: "absolute" as const,
          left: width / 2 + (tx * TILE - x),
          top: height / 2 + (ty * TILE - y),
          width: TILE,
          height: TILE,
        };
        const current = LAYERS[layer];
        tiles.push(<Image key={`b${zoom}:${tx}:${ty}`} source={{ uri: current.base(zoom, wrappedX, ty) }} style={style} />);
        if (current.labels) {
          tiles.push(<Image key={`l${zoom}:${tx}:${ty}`} source={{ uri: current.labels(zoom, wrappedX, ty) }} style={style} />);
        }
      }
    }
  }

  const pinned = toLatLon(x, y, zoom);
  const current = LAYERS[layer];

  return (
    <View style={[styles.frame, { height }]} onLayout={onLayout} {...panResponder.panHandlers}>
      {tiles}

      <View pointerEvents="none" style={[styles.pin, { left: width / 2 - 20, top: height / 2 - 40 }]}>
        <MaterialCommunityIcons name="map-marker" size={40} color={Palette.danger} />
      </View>

      <View style={styles.topLeft}>
        <Pressable onPress={() => setLayer(layer === "satellite" ? "street" : "satellite")} style={styles.chip}>
          <MaterialCommunityIcons name={LAYERS[layer === "satellite" ? "street" : "satellite"].icon} size={16} color={Palette.primary} />
          <Text style={styles.chipText}>{LAYERS[layer === "satellite" ? "street" : "satellite"].label}</Text>
        </Pressable>
      </View>

      <View style={styles.zoomColumn}>
        <Pressable onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} style={styles.zoomButton} hitSlop={6}>
          <MaterialCommunityIcons name="plus" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} style={styles.zoomButton} hitSlop={6}>
          <MaterialCommunityIcons name="minus" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.coordsChip}>
        <MaterialCommunityIcons name="crosshairs-gps" size={13} color={Palette.primary} />
        <Text style={styles.coordsText}>
          {pinned.latitude.toFixed(5)}, {pinned.longitude.toFixed(5)}
        </Text>
      </View>

      <Text pointerEvents="none" style={styles.attribution}>{current.attribution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Colors.backgroundSelected },
  pin: { position: "absolute", width: 40, height: 40, alignItems: "center", justifyContent: "flex-end" },
  topLeft: { position: "absolute", top: Spacing.two, left: Spacing.two },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontFamily: FontFamily.semibold, fontSize: 13, color: Palette.primary },
  zoomColumn: {
    position: "absolute",
    right: Spacing.two,
    top: "50%",
    marginTop: -50,
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  zoomButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  zoomDivider: { height: 1, backgroundColor: Colors.border },
  coordsChip: {
    position: "absolute",
    bottom: Spacing.two,
    left: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  coordsText: { fontFamily: FontFamily.semibold, fontSize: 11, color: Colors.text },
  attribution: {
    position: "absolute",
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 2,
  },
});
