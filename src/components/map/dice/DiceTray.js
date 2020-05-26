import React, { useRef, useCallback, useEffect, useContext } from "react";
import * as BABYLON from "babylonjs";
import { Box } from "theme-ui";

import environment from "../../../dice/environment.dds";

import Scene from "./DiceScene";
import DiceControls from "./DiceControls";
import Dice from "../../../dice/Dice";

import createDiceTray, {
  diceTraySize,
} from "../../../dice/diceTray/DiceTrayMesh";

import MapInteractionContext from "../../../contexts/MapInteractionContext";

function DiceTray({ isOpen }) {
  const sceneRef = useRef();
  const shadowGeneratorRef = useRef();
  const diceRefs = useRef([]);
  const sceneVisibleRef = useRef(false);
  const sceneInteractionRef = useRef(false);
  // Set to true to ignore scene sleep and visible values
  const forceSceneRenderRef = useRef(false);

  useEffect(() => {
    let openTimeout;
    if (isOpen) {
      sceneVisibleRef.current = true;
      // Force scene rendering on open for 1s to ensure dice tray is rendered
      forceSceneRenderRef.current = true;
      openTimeout = setTimeout(() => {
        forceSceneRenderRef.current = false;
      }, 1000);
    } else {
      sceneVisibleRef.current = false;
    }
    return () => {
      if (openTimeout) {
        clearTimeout(openTimeout);
      }
    };
  }, [isOpen]);

  const handleSceneMount = useCallback(({ scene, engine }) => {
    sceneRef.current = scene;
    initializeScene(scene);
    engine.runRenderLoop(() => update(scene));
  }, []);

  async function initializeScene(scene) {
    var light = new BABYLON.DirectionalLight(
      "DirectionalLight",
      new BABYLON.Vector3(-0.5, -1, -0.5),
      scene
    );
    light.position = new BABYLON.Vector3(5, 10, 5);
    light.shadowMinZ = 1;
    light.shadowMaxZ = 50;
    let shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.useCloseExponentialShadowMap = true;
    shadowGenerator.darkness = 0.7;
    shadowGeneratorRef.current = shadowGenerator;

    var ground = BABYLON.Mesh.CreateGround("ground", 100, 100, 2, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
      ground,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0, friction: 20.0 },
      scene
    );
    ground.isVisible = false;
    ground.position.y = 0.2;

    const wallSize = 50;

    function createWall(name, x, z, yaw) {
      let wall = BABYLON.Mesh.CreateBox(
        name,
        wallSize,
        scene,
        true,
        BABYLON.Mesh.DOUBLESIDE
      );
      wall.rotation = new BABYLON.Vector3(0, yaw, 0);
      wall.position.z = z;
      wall.position.x = x;
      wall.physicsImpostor = new BABYLON.PhysicsImpostor(
        wall,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, friction: 10.0 },
        scene
      );
      wall.isVisible = false;
    }

    const wallOffsetWidth = wallSize / 2 + diceTraySize.width / 2 - 0.5;
    const wallOffsetHeight = wallSize / 2 + diceTraySize.height / 2 - 0.5;
    createWall("wallTop", 0, -wallOffsetHeight, 0);
    createWall("wallRight", -wallOffsetWidth, 0, Math.PI / 2);
    createWall("wallBottom", 0, wallOffsetHeight, Math.PI);
    createWall("wallLeft", wallOffsetWidth, 0, -Math.PI / 2);

    var roof = BABYLON.Mesh.CreateGround("roof", 100, 100, 2, scene);
    roof.physicsImpostor = new BABYLON.PhysicsImpostor(
      roof,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0, friction: 100.0 },
      scene
    );
    roof.position.y = 10;
    roof.isVisible = false;

    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      environment,
      scene
    );
    scene.environmentIntensity = 1.0;

    createDiceTray(scene, shadowGenerator);
  }

  function update(scene) {
    function getDiceSpeed(dice) {
      const diceSpeed = dice.instance.physicsImpostor
        .getLinearVelocity()
        .length();
      // If the dice is a d100 check the d10 as well
      if (dice.type === "d100") {
        const d10Speed = dice.d10Instance.physicsImpostor
          .getLinearVelocity()
          .length();
        return Math.max(diceSpeed, d10Speed);
      } else {
        return diceSpeed;
      }
    }

    const die = diceRefs.current;
    const sceneVisible = sceneVisibleRef.current;
    if (!sceneVisible) {
      return;
    }
    const sceneInteraction = sceneInteractionRef.current;
    const forceSceneRender = forceSceneRenderRef.current;
    const diceAwake = die.map((dice) => dice.asleep).includes(false);
    // Return early if scene doesn't need to be re-rendered
    if (!forceSceneRender && !sceneInteraction && !diceAwake) {
      return;
    }

    for (let i = 0; i < die.length; i++) {
      const dice = die[i];
      const speed = getDiceSpeed(dice);
      // If the speed has been below 0.01 for 1s set dice to sleep
      if (speed < 0.01 && !dice.sleepTimout) {
        dice.sleepTimout = setTimeout(() => {
          dice.asleep = true;
        }, 1000);
      } else if (speed > 0.5 && (dice.asleep || dice.sleepTimout)) {
        dice.asleep = false;
        clearTimeout(dice.sleepTimout);
        dice.sleepTimout = null;
      }
    }

    if (scene) {
      scene.render();
    }
  }

  async function handleDiceAdd(style, type) {
    const scene = sceneRef.current;
    const shadowGenerator = shadowGeneratorRef.current;
    if (scene && shadowGenerator) {
      const instance = await style.createInstance(type, scene);
      shadowGenerator.addShadowCaster(instance);
      Dice.roll(instance);
      let dice = { type, instance, asleep: false };
      // If we have a d100 add a d10 as well
      if (type === "d100") {
        const d10Instance = await style.createInstance("d10", scene);
        shadowGenerator.addShadowCaster(d10Instance);
        Dice.roll(d10Instance);
        dice.d10Instance = d10Instance;
      }
      diceRefs.current.push(dice);
    }
  }

  function handleDiceClear() {
    const die = diceRefs.current;
    for (let dice of die) {
      dice.instance.dispose();
      if (dice.type === "d100") {
        dice.d10Instance.dispose();
      }
    }
    diceRefs.current = [];
    // Force scene rendering to show cleared dice
    forceSceneRenderRef.current = true;
    setTimeout(() => {
      if (forceSceneRenderRef) {
        forceSceneRenderRef.current = false;
      }
    }, 100);
  }

  function handleDiceReroll() {
    const die = diceRefs.current;
    for (let dice of die) {
      Dice.roll(dice.instance);
      if (dice.type === "d100") {
        Dice.roll(dice.d10Instance);
      }
      dice.asleep = false;
    }
  }

  const { setPreventMapInteraction } = useContext(MapInteractionContext);

  return (
    <Box
      sx={{
        width: "500px",
        maxWidth: "calc(50vh - 48px)",
        paddingBottom: "200%",
        borderRadius: "4px",
        display: isOpen ? "block" : "none",
        position: "relative",
        overflow: "hidden",
      }}
      bg="background"
    >
      <Scene
        onSceneMount={handleSceneMount}
        onPointerDown={() => {
          sceneInteractionRef.current = true;
          setPreventMapInteraction(true);
        }}
        onPointerUp={() => {
          sceneInteractionRef.current = false;
          setPreventMapInteraction(false);
        }}
      />
      <DiceControls
        diceRefs={diceRefs}
        sceneVisibleRef={sceneVisibleRef}
        onDiceAdd={handleDiceAdd}
        onDiceClear={handleDiceClear}
        onDiceReroll={handleDiceReroll}
      />
    </Box>
  );
}

export default DiceTray;
