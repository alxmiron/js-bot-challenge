'use strict'; // eslint-disable-line

const PI = Math.PI;

const GOALKEEPER = 1;
const PLAYMAKER_TOP = 0;
const PLAYMAKER_BOTTOM = 2;

const GOALKEEPER_POS_X = 0.07; // % of field width
const GoalkeeperModes = {
  FOLLOW: 'FOLLOW', // align Y with the ball, but keep goalkeeper X distance
  DEFENCE: 'DEFENCE', // move toward the ball
  DEFAULT: 'FOLLOW',
};

// const PlaymakerModes = {
//   ATTACK: 'ATTACK',
//   FOLLOW: 'FOLLOW',
//   DEFENCE: 'DEFENCE',
// };
const PlaymakerTypes = {
  TOP: PLAYMAKER_TOP,
  BOTTOM: PLAYMAKER_BOTTOM,
};

const Zones = {
  G: 'G',
  PT: 'PT',
  PB: 'PB',
};

const PlayerZone = {
  [GOALKEEPER]: Zones.G,
  [PLAYMAKER_TOP]: Zones.PT,
  [PLAYMAKER_BOTTOM]: Zones.PB,
};

const POS_EPS = 2;
// const DIR_EPS = PI / 180;

function getPlayerMove(data) {
  const currentPlayer = data.yourTeam.players[data.playerIndex];
  let moveObj = {
    direction: currentPlayer.direction,
    velocity: 0,
  };

  switch (data.playerIndex) {
    case GOALKEEPER:
      moveObj = calculateGoalkeeperMove(data);
      break;
    default:
      moveObj = calculatePlaymakerMove(data, data.playerIndex);
  }

  return {
    direction: moveObj.direction,
    velocity: moveObj.velocity,
  };
}


// -------------------------------------
// Goalkeeper
// -------------------------------------
function calculateGoalkeeperMove(data) {
  const ball = data.ball;
  const ballStop = getBallStats(ball, data.settings);
  const player = data.yourTeam.players[data.playerIndex];

  const fieldWidth = data.settings.field.width;
  // const fieldHeight = data.settings.field.height;
  const ballRadius = data.settings.ball.radius;
  const playerRadius = data.settings.player.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const zones = getZonesParams(data);
  const goalkeeperZoneEnd = zones[Zones.G].end;

  const mode = ballStop.x < goalkeeperZoneEnd ?
    GoalkeeperModes.DEFENCE :
    GoalkeeperModes.FOLLOW;

  let moveDirection = player.direction;
  let moveVelocity = 0;

  // ballStop.x = fieldWidth / 2;
  // ballStop.y = fieldHeight * 0.1;

  // if (!shouldGoalkeeperMove(mode, player, ball, ballStop)) {
  //   return {
  //     direction: moveDirection,
  //     velocity: moveVelocity,
  //   };
  // }

  const currentPoint = player;
  const targetPoint = mode === GoalkeeperModes.FOLLOW ? {
    x: GOALKEEPER_POS_X * fieldWidth,
    y: ballStop.y,
  } : {
    x: ballStop.x - ballRadius,
    y: ballStop.y,
  };
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const targetDistance = getDistance(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  moveDirection = targetDirection;
  moveVelocity = getGoalkeeperVelocity(
    mode,
    getPlayerVelocity(
      player.velocity,
      directionDelta,
      maxPlayerVelocity,
      2,
    ),
    targetDistance,
    playerRadius,
    maxPlayerVelocity,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

// function shouldGoalkeeperMove(mode, goalkeeper, ball, ballStop) {
//   switch (mode) {
//     case GoalkeeperModes.FOLLOW:
//       if (ballStop.stopTime === 0 && Math.abs(ball.y - goalkeeper.y) < POS_EPS) {
//         return false;
//       }
//       break;
//     default:
//   }
//   return true;
// }

function getGoalkeeperVelocity(
  mode = GoalkeeperModes.DEFAULT,
  velocity,
  distance,
  playerRadius,
  maxPlayerVelocity,
) {
  switch (mode) {
    case GoalkeeperModes.FOLLOW:
      return slowStopPlayer(velocity, distance, playerRadius, maxPlayerVelocity);
    case GoalkeeperModes.DEFENCE:
      return velocity;
    default:
  }
  return null;
}


// -------------------------------------
// Playmakers
// -------------------------------------
function calculatePlaymakerMove(data, playmakerType) {
  const player = data.yourTeam.players[data.playerIndex];
  const playerRadius = data.settings.player.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const ball = data.ball;
  const ballRadius = data.settings.ball.radius;
  const ballStop = getBallStats(ball, data.settings);

  const zones = getZonesParams(data);
  const playerZone = PlayerZone[playmakerType];
  const ballZone = detectPointZone(zones, ball, data.settings.field);
  // console.dir(ballZone);

  let moveObj = {
    direction: player.direction,
    velocity: 0,
  };

  if (ballZone.center) {
    if (playmakerType === PlaymakerTypes.TOP) {
      return calculateAttackPlaymakerMove(player, ball, ballStop, maxPlayerVelocity, ballRadius);
    }
    return calculateFollowPlaymakerMove(
      player,
      playerZone,
      ballStop,
      zones,
      maxPlayerVelocity,
      playerRadius,
    );
  }

  if (ballZone.zone === playerZone || ballZone.zone === Zones.G) {
    if (ballZone.aggressive) {
      moveObj = calculateAttackPlaymakerMove(player, ball, ballStop, maxPlayerVelocity, ballRadius);
    } else {
      // moveObj = calculateDefencePlaymakerMove();
      moveObj = calculateAttackPlaymakerMove(player, ball, ballStop, maxPlayerVelocity, ballRadius);
    }
  } else {
    moveObj = calculateFollowPlaymakerMove(
      player,
      playerZone,
      ballStop,
      zones,
      maxPlayerVelocity,
      playerRadius,
    );
  }

  return moveObj;
}

function calculateAttackPlaymakerMove(player, ball, ballStop, maxPlayerVelocity, ballRadius) {
  const currentPoint = player;
  const targetPoint = ball;
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  const moveDirection = Math.atan2(ball.y - player.y, ball.x - player.x - ballRadius);
  const moveVelocity = getPlayerVelocity(
    player.velocity,
    directionDelta,
    maxPlayerVelocity,
    2,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

// function calculateDefencePlaymakerMove() {
//
// }

function calculateFollowPlaymakerMove(
  player,
  playerZone,
  ballStop,
  zones,
  maxPlayerVelocity,
  playerRadius,
) {
  const currentPoint = player;
  const targetPoint = {
    x: Math.max(ballStop.x - (playerRadius * 6), 0),
    y: getPlaymakerFollowPositionY(zones[playerZone]),
  };
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);
  // const targetDistance = getDistance(currentPoint, targetPoint);

  const moveDirection = targetDirection;
  // const moveVelocity = slowStopPlayer(
  //   getPlayerVelocity(
  //     player.velocity,
  //     directionDelta,
  //     maxPlayerVelocity,
  //     2,
  //   ),
  //   targetDistance,
  //   playerRadius,
  //   maxPlayerVelocity,
  // );
  const moveVelocity = getPlayerVelocity(
    player.velocity,
    directionDelta,
    maxPlayerVelocity,
    2,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function getPlaymakerFollowPositionY(zone) {
  return zone.top + ((zone.bottom - zone.top) / 2);
}

// -------------------------------------
// Ball utils
// -------------------------------------
function getBallStats(ball, gameSettings) {
  const stopTime = getBallStopTime(ball);
  const stopDistance = (ball.velocity * stopTime)
    - (ball.settings.moveDeceleration * (((stopTime + 1) * stopTime) / 2));

  const x = ball.x + (stopDistance * Math.cos(ball.direction));
  let y = Math.abs(ball.y + (stopDistance * Math.sin(ball.direction)));

  // check the reflection from field side
  if (y > gameSettings.field.height) y = (2 * gameSettings.field.height) - y;

  return {
    stopTime,
    stopDistance,
    x,
    y,
  };
}

function getBallStopTime(ball) {
  return ball.velocity / ball.settings.moveDeceleration;
}


// -------------------------------------
// Common utils
// -------------------------------------
function getDirectionTo(startPoint, endPoint) {
  return Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
}

function getDistance(point1, point2) {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

function getPlayerVelocity( // Formula 1
  currentVelocity,
  directionDelta,
  maxVelocity,
  exponent = 1,
) {
  const velocity = Math.max(
    maxVelocity - (
      Math.pow((Math.abs(directionDelta) / (PI / 2)), exponent) * currentVelocity
    ),
    0,
  );
  return velocity;
}

function convertEngineDirection(engineDirection) { // Formula 2
  return engineDirection > PI ? engineDirection - (2 * PI) : engineDirection;
}

function getZonesParams(data) {
  const fieldWidth = data.settings.field.width;
  const fieldHeight = data.settings.field.height;

  return {
    [Zones.G]: {
      start: 0,
      end: GOALKEEPER_POS_X * 4 * fieldWidth,
      top: 0,
      bottom: fieldHeight,
    },
    [Zones.PT]: {
      start: GOALKEEPER_POS_X * 4 * fieldWidth,
      end: fieldWidth,
      top: 0,
      bottom: fieldHeight * 0.5,
    },
    [Zones.PB]: {
      start: GOALKEEPER_POS_X * 4 * fieldWidth,
      end: fieldWidth,
      top: fieldHeight * 0.5,
      bottom: fieldHeight,
    },
  };
}

function detectPointZone(zones, point, field) {
  const x = point.x;
  const y = point.y;
  const result = {
    zone: null,
    defence: false,
    aggressive: false,
    center: false,
  };

  if (x > zones[Zones.G].end) {
    if (y < zones[Zones.PT].bottom) {
      result.zone = Zones.PT;
    } else {
      result.zone = Zones.PB;
    }
    if (x < field.width * 0.5) {
      result.defence = true;
    } else {
      result.aggressive = true;
    }
  } else {
    result.zone = Zones.G;
  }
  if (Math.abs(x - (field.width / 2) < POS_EPS) &&
      Math.abs(y - (field.height / 2) < POS_EPS)) {
    result.center = true;
  }

  return result;
}

function slowStopPlayer(velocity, distance, playerRadius, maxPlayerVelocity) { // Formula 3
  let newVelocity = velocity;
  const stopThreshold = playerRadius * (velocity / maxPlayerVelocity) * 8;
  if (distance < stopThreshold) {
    newVelocity = 0;
  }
  return newVelocity;
}

// -------------------------------------
onmessage = e => postMessage(getPlayerMove(e.data));
