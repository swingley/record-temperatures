const go = data => {
  const avg = Object.values(data.avg)
  const min = Object.values(data.min)
  const max = Object.values(data.max)

  // orange-purple
  const AVG_COLOR = '#7d7e89'
  const MAX_COLOR = '#b35806'
  const MIN_COLOR = '#542788'
  const DEGREE = '&deg;'
  // red-blue
  // const AVG_COLOR = '#fdae61'
  // const MAX_COLOR = '#d53e4f'
  // const MIN_COLOR = '#3288bd'

  const dateFromDay = day => {
    const date = new Date(2000, 0)
    return new Date(date.setDate(day + 1))
  }
  const days = avg.map((val, index) => dateFromDay(index))

  // d3
  const margin = {
    top: 10,
    right: 30,
    bottom: 30,
    left: 20
  }
  const width = (avg.length * 2) - margin.left - margin.right
  const height = 400 - margin.top - margin.bottom
  const annualChart = d3.select('.annual-chart')
  const chartDimensions = annualChart.node().getBoundingClientRect()
  const viewBox = `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
  const main = annualChart.append('svg')
      .attr('viewBox', viewBox)
      .attr('class', 'annual-records')
      // .attr('width', width + margin.left + margin.right)
      .attr('width', chartDimensions.width)
      // .attr('height', height + margin.top + margin.bottom)
      .attr('height', chartDimensions.height)
  const chart = main.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
  // need x and y scales...
  // const avgExtent = extent(avg, d => d.value)
  // const minExtent = extent(min, d => d.value)
  // const maxExtent = extent(max, d => d.value)
  const avgExtent = d3.extent(avg)
  const minExtent = d3.extent(min)
  const maxExtent = d3.extent(max)
  const fullExtent = d3.extent([ ...avgExtent, ...minExtent, ...maxExtent ])

  const x = d3.scaleTime()
    .domain([dateFromDay(0), dateFromDay(avg.length - 1)])
    .range([0, width])
  const y = d3.scaleLinear()
    .domain(fullExtent)
    .range([height, 0])

  const horizontalTipPosition = d3.scaleLinear()
    .domain([0, width])
    .range([0, chartDimensions.width - margin.left - margin.right])
  console.log('horizontalTipPosition two widths', width, chartDimensions.width - margin.left - margin.right)

  const customMonthTicks = x.ticks()
  const month = d3.timeFormat('%b')
  const monthDay = d3.timeFormat('%b %d')

  chart.append('g')
    .attr('transform', `translate(0, ${height})`)
    .attr('class', 'monospace')
    .call(d3.axisBottom(x).tickSize(0).tickFormat(month).tickValues(customMonthTicks))
  chart.append('g')
    .attr('class', 'monospace')
    .call(d3.axisLeft(y).tickSize(0))

  const addLine = (container, data, color) => {
    container.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', d3.line()
        .x((d, i) => x(dateFromDay(i)))
        // .y(d => y(d.value))
        .y(d => y(d))
      )
  }

  const addLabel = (container, data, color, label) => {
    const textOffset = 6
    const highestValueOfLastThirty = Math.max.apply(null, data.slice(data.length - 31))
    // console.log('highestValueOfLastThirty', highestValueOfLastThirty)
    const decStart = data[data.length - 31]
    const textX = x(dateFromDay(data.length - 31))
    const textY = y(highestValueOfLastThirty)
    // console.log(label, textX, textY)
    container.append('text')
      .attr('x', textX)
      .attr('y', textY - textOffset)
      .attr('fill', color)
      .attr('font-family', 'monospace')
      .text(label)
  }

  addLine(chart, avg, AVG_COLOR)
  addLine(chart, min, MIN_COLOR)
  addLine(chart, max, MAX_COLOR)

  addLabel(chart, avg, AVG_COLOR, 'AVG')
  addLabel(chart, min, MIN_COLOR, 'MIN')
  addLabel(chart, max, MAX_COLOR, 'MAX')

  const tip = d3.select('.annual-chart').append('div')
    .attr('class', 'tip')
    .style('display', 'none')
    .style('position', 'absolute')
    .text('hi hi hi')

  const bisectDate = d3.bisector(d => d).left
  const focus = chart.append("g").style("display", "none")
  // append the x line
  focus.append("line")
    .attr("class", "x")
    .style("stroke", AVG_COLOR)
    // .style("stroke-dasharray", "3,3")
    .style("opacity", 0.5)
    .attr("y1", 0)
    .attr("y2", height);

  focus.append("circle")
    .attr("class", "avg")
    .style("fill", "none")
    .style("stroke", AVG_COLOR)
    .style("stroke-width", '2')
    .attr("r", 4);

  focus.append("circle")
    .attr("class", "min")
    .style("fill", "none")
    .style("stroke", MIN_COLOR)
    .style("stroke-width", '2')
    .attr("r", 4);

  focus.append("circle")
    .attr("class", "max")
    .style("fill", "none")
    .style("stroke", MAX_COLOR)
    .style("stroke-width", '2')
    .attr("r", 4);

  function mousemove(event) {
    const position = d3.pointer(event, this)
    const x0 = x.invert(position[0])
    const i = bisectDate(days, x0, 0)
    const currentAvg = avg[i]
    const currentMin = min[i]
    const currentMax = max[i]

    const xPosition = x(dateFromDay(i))
    const yPosition = y(currentAvg)
    const yPositionMin = y(currentMin)
    const yPositionMax = y(currentMax)

    focus.select("circle.avg")
      .attr("transform", `translate(${xPosition}, ${yPosition})`)

    focus.select('circle.min')
      .attr('transform', `translate(${xPosition}, ${yPositionMin})`)

    focus.select('circle.max')
      .attr('transform', `translate(${xPosition}, ${yPositionMax})`)

    focus.select(".x")
      .attr("transform", `translate(${xPosition}, ${yPositionMax})`)
      .attr("y2", height - yPositionMax);

    const { top, left, width } = this.getBoundingClientRect()
    const leftPad = horizontalTipPosition(position[0]) > width / 2 ? -100 : 42
    tip
      .style('top', `40px`)
      // .style('left', `${left + position[0] + leftPad}px`)
      .style('left', `${horizontalTipPosition(position[0]) + leftPad}px`)
      .html(`${monthDay(dateFromDay(i))}<br /><br />
        <span style='color: ${MAX_COLOR}'>Max:  ${currentMax}${DEGREE}F</span><br />
        <span style='color: ${AVG_COLOR}'>Avg:  ${currentAvg}${DEGREE}F</span><br />
        <span style='color: ${MIN_COLOR}'>Min:  ${currentMin}${DEGREE}F</span>
      `)
    return
  }

  chart.append('rect')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mouseover', function() {
      focus.style('display', null)
      tip.style('display', null)
    })
    .on('mouseout', function() {
      focus.style('display', 'none')
      tip.style('display', 'none')
    })
    .on('mousemove', mousemove);
}
