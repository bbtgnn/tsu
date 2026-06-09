import paper from 'paper';

// Set up paper on the canvas (the `resize` attribute in the HTML
// keeps the canvas in sync with the window size).
paper.setup(document.getElementById('canvas'));

const { Path, Point, view } = paper;

// Demo: a wavy line that follows a sine curve and reacts to the mouse.
const path = new Path({
  strokeColor: '#4fc3f7',
  strokeWidth: 3,
  strokeCap: 'round',
});

const SEGMENTS = 40;

function buildPath() {
  path.removeSegments();
  for (let i = 0; i <= SEGMENTS; i++) {
    path.add(new Point((view.size.width / SEGMENTS) * i, view.center.y));
  }
}

buildPath();

view.onResize = buildPath;

view.onFrame = (event) => {
  for (let i = 0; i <= SEGMENTS; i++) {
    const segment = path.segments[i];
    const sine = Math.sin(event.time * 2 + i * 0.4);
    segment.point.y = view.center.y + sine * 60;
  }
  path.smooth();
};

// Click to drop a circle that fades out.
view.onMouseDown = (event) => {
  const circle = new Path.Circle({
    center: event.point,
    radius: 10,
    fillColor: '#ff7043',
  });
  circle.onFrame = () => {
    circle.scale(1.05);
    circle.opacity -= 0.02;
    if (circle.opacity <= 0) circle.remove();
  };
};
