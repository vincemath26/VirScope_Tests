import React from 'react';
import Plot from 'react-plotly.js';

function Enterovirus({
  interactiveData,
  customTitle,
  xAxisTitle,
  yAxisTitle,
  highlights = []
}) {
  if (!interactiveData?.moving_sum?.length) return <span>No antigen map data available</span>;

  const proteinColours = { 
    "VP4": "#428984", "VP2": "#6FC0EE", "VP3": "#26DED8E6", "VP1": "#C578E6",
    "2A": "#F6F4D6", "2B": "#D9E8E5", "2C": "#EBF5D8", "3AB": "#EDD9BA",
    "3C": "#EBD2D0", "3D": "#FFB19A"
  };

  const polyproteinShapes = interactiveData.ev_domains?.map(domain => ({
    type: 'rect',
    x0: domain.start,
    x1: domain.end,
    y0: 0,
    y1: 0.2,
    fillcolor: proteinColours[domain.ev_proteins] || "#CCCCCC",
    line: { color: 'black', width: 0.5 },
    xref: 'x',
    yref: 'y'
  }));

  const polyproteinAnnotations = interactiveData.ev_domains?.map(domain => ({
    x: (domain.start + domain.end) / 2,
    y: 0.1,
    text: domain.ev_proteins,
    showarrow: false,
    font: { size: 12, color: 'black', family: 'Arial' },
    xref: 'x',
    yref: 'y',
    align: 'center'
  }));

  const caseTrace = {
    x: interactiveData.window_start,
    y: interactiveData.moving_sum.map(v => Math.max(0, v)),
    type: 'scatter',
    mode: 'lines',
    fill: 'tozeroy',
    fillcolor: '#d73027',
    line: { color: '#d73027' },
    name: 'Case',
    xaxis: 'x2',
    yaxis: 'y2'
  };

  const controlTrace = {
    x: interactiveData.window_start,
    y: interactiveData.moving_sum.map(v => Math.min(0, v)),
    type: 'scatter',
    mode: 'lines',
    fill: 'tozeroy',
    fillcolor: '#4575b4',
    line: { color: '#4575b4' },
    name: 'Control',
    xaxis: 'x2',
    yaxis: 'y2'
  };

  const mainTitleAnnotation = customTitle
    ? [{ x: 0.5, y: 1.05, xref: 'paper', yref: 'paper', text: customTitle, showarrow: false, font: { size: 18 }, xanchor: 'center', yanchor: 'bottom' }]
    : [];

  const polyproteinHeight = 80;
  const antigenMapHeight = 700;
  const totalHeight = polyproteinHeight + antigenMapHeight + 120;

  const layoutProps = { width: Math.min(1200, window.innerWidth - 40), margin: { l: 120, r: 50, t: 100, b: 120 } };

  const layout = {
    ...layoutProps,
    height: totalHeight,
    dragmode: 'zoom',
    yaxis: { visible: false, showticklabels: false, showline: false, zeroline: false, domain: [1 - polyproteinHeight / totalHeight, 1] },
    xaxis: { visible: false, matches: 'x2' },
    yaxis2: { title: { text: yAxisTitle || 'Moving Sum', font: { size: 16 } }, automargin: true, domain: [0, 1 - polyproteinHeight / totalHeight], fixedrange: false },
    xaxis2: { title: { text: xAxisTitle || 'Position in sequence (aa)', font: { size: 16 } }, side: 'bottom', automargin: true, showline: true, showticklabels: true, anchor: 'y2', domain: [0, 1] },
    shapes: [...polyproteinShapes, ...highlights],
    annotations: [...mainTitleAnnotation, ...polyproteinAnnotations],
    showlegend: true
  };

  return <Plot id="antigen-map-plot" data={[caseTrace, controlTrace]} layout={layout} config={{ responsive: true }} />;
}

export default Enterovirus;
