'use strict'; // eslint-disable-line

const PI = Math.PI;

const GOALKEEPER = 1;
const PLAYMAKER_TOP = 0;
const PLAYMAKER_BOTTOM = 2;

const GOALKEEPER_POS_X = 80 / 708; // % of field width
const GoalkeeperModes = {
  FOLLOW: 'FOLLOW', // align Y with the ball, but keep goalkeeper X distance
  DEFENCE: 'DEFENCE', // move toward the ball
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
  const ballStop = getBallStop(ball, data.settings);
  const player = data.yourTeam.players[data.playerIndex];

  const fieldWidth = data.settings.field.width;
  const ballRadius = data.settings.ball.radius;
  const zones = getZonesParams(data);
  const goalkeeperZoneEnd = zones[Zones.G].end;

  const mode = (ballStop.x < goalkeeperZoneEnd || ball.x < goalkeeperZoneEnd) ?
    GoalkeeperModes.DEFENCE :
    GoalkeeperModes.FOLLOW;

  let moveDirection = player.direction;
  let moveVelocity = 0;

  const currentPoint = player;
  const distanceToBall = getDistance(currentPoint, ball);
  let targetPoint;
  switch (mode) {
    case GoalkeeperModes.FOLLOW:
      targetPoint = {
        x: GOALKEEPER_POS_X * fieldWidth,
        y: ballStop.y + posNoize(ballRadius),
      };
      break;
    case GoalkeeperModes.DEFENCE:
      targetPoint = distanceToBall <= ballRadius ? {
        x: ball.x,
        y: ball.y,
      } : {
        x: ballStop.x - ballRadius,
        y: ballStop.y,
      };
      break;
    default:
  }
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const targetDistance = getDistance(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  moveDirection = targetDirection;
  moveVelocity = getGoalkeeperVelocity(
    data,
    mode,
    getPlayerVelocity(
      data,
      player.velocity,
      directionDelta,
    ),
    targetDistance,
    distanceToBall,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function getGoalkeeperVelocity(
  data,
  mode,
  velocity,
  targetDistance,
  distanceToBall,
) {
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const playerRadius = data.settings.player.radius;
  const ballRadius = data.settings.ball.radius;

  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;

  switch (mode) {
    case GoalkeeperModes.FOLLOW:
      return slowStopPlayer(velocity, targetDistance, playerRadius, maxPlayerVelocity);
    case GoalkeeperModes.DEFENCE:
      return (distanceToBall <= ballRadius && player.x < ball.x) ?
        maxPlayerVelocity :
        velocity;
    default:
  }
  return null;
}


// -------------------------------------
// Playmakers
// -------------------------------------
function calculatePlaymakerMove(data, playmakerType) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;
  const playerZone = PlayerZone[playmakerType];

  const ballStop = getBallStop(ball, data.settings);
  const zones = getZonesParams(data);
  const ballZone = detectPointZone(data, zones, ball);

  let moveObj = {
    direction: player.direction,
    velocity: 0,
  };

  if (ballZone.center) {
    if (playmakerType === PlaymakerTypes.TOP) {
      return calculateAttackPlaymakerMove(data, playmakerType);
    }
    return calculateFollowPlaymakerMove(data, playmakerType, ballStop, zones);
  }

  if (ballZone.zone === playerZone || ballZone.zone === Zones.G) {
    if (ballZone.aggressive || (ballZone.closeToEdge && !ballZone.defence)) {
      moveObj = calculateAttackPlaymakerMove(data, playmakerType);
    } else {
      moveObj = calculateDefencePlaymakerMove(data, playmakerType);
    }
  } else {
    moveObj = calculateFollowPlaymakerMove(data, playmakerType, ballStop, zones);
  }

  return moveObj;
}

function calculateAttackPlaymakerMove(data) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;
  const ballRadius = data.settings.ball.radius;

  const currentPoint = player;
  const targetPoint = ball;
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  const moveDirection = Math.atan2(ball.y - player.y, ball.x - player.x - ballRadius);
  const moveVelocity = getPlayerVelocity(
    data,
    player.velocity,
    directionDelta,
  );

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function calculateDefencePlaymakerMove(data) {
  const player = data.yourTeam.players[data.playerIndex];
  const ball = data.ball;

  const moveDirection = player.direction;
  const moveVelocity = 0;

  if (ball.x > player.x) {
    return calculateAttackPlaymakerMove(data);
  }

  return {
    direction: moveDirection,
    velocity: moveVelocity,
  };
}

function calculateFollowPlaymakerMove(data, playmakerType, ballStop, zones) {
  const player = data.yourTeam.players[data.playerIndex];
  const playerRadius = data.settings.player.radius;
  const ballRadius = data.settings.ball.radius;
  const maxPlayerVelocity = data.settings.player.maxVelocity;
  const playerZone = PlayerZone[playmakerType];

  const currentPoint = player;
  const targetPoint = {
    x: Math.max((ballStop.x + posNoize(ballRadius)) - (playerRadius * 6), 0),
    y: getPlaymakerFollowPositionY(zones[playerZone]),
  };
  const targetDirection = getDirectionTo(currentPoint, targetPoint);
  const directionDelta = targetDirection - convertEngineDirection(player.direction);

  const moveDirection = targetDirection;
  const moveVelocity = getPlayerVelocity(
    data,
    player.velocity,
    directionDelta,
    maxPlayerVelocity,
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
function getBallStop(ball, gameSettings) {
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
  data,
  currentVelocity,
  directionDelta,
  exponent = 2,
) {
  const maxVelocity = data.settings.player.maxVelocity;
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
  const goalkeeperZoneEnd = (fieldWidth / 2) * 0.65;

  return {
    [Zones.G]: {
      start: 0,
      end: goalkeeperZoneEnd,
      top: 0,
      bottom: fieldHeight,
    },
    [Zones.PT]: {
      start: goalkeeperZoneEnd,
      end: fieldWidth,
      top: 0,
      bottom: fieldHeight * 0.5,
    },
    [Zones.PB]: {
      start: goalkeeperZoneEnd,
      end: fieldWidth,
      top: fieldHeight * 0.5,
      bottom: fieldHeight,
    },
  };
}

function detectPointZone(data, zones, point) {
  const field = data.settings.field;
  const x = point.x;
  const y = point.y;
  const eps = data.settings.ball.radius * 4;
  const result = {
    zone: null,
    defence: false,
    aggressive: false,
    center: false,
    closeToEdge: false,
  };

  if (x > zones[Zones.G].end) {
    if (y < zones[Zones.PT].bottom) {
      result.zone = Zones.PT;
    } else {
      result.zone = Zones.PB;
    }
    if (Math.abs(y - zones[Zones.PT].bottom) < eps) {
      result.closeToEdge = true;
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

function posNoize(ballRadius) {
  return (Math.random() * (ballRadius * 2)) - ballRadius;
}

// -------------------------------------
onmessage = e => postMessage(getPlayerMove(e.data));
