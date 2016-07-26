// Copyright 2016 Arne Johanson
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function CanvasDataPlot(parentElement, canvasDimensions, config) {
	config = config || {};

	this.data = []; // (default implementation: [dataSet][dataPoint][[0: x, 1: y]], ordered ascendingly by x value)
	this.dataIDs = [];
	this.dataLabels = [];
	this.displayIndexStart = [];
	this.displayIndexEnd = [];
	this.dataColors = [];
	this.xAxisLabelText = config.xAxisLabel || "";
	this.yAxisLabelText = config.yAxisLabel || "";
	this.updateViewCallback = config.updateViewCallback || null;
	this.parent = parentElement;

	this.disableLegend = config.disableLegend || false;
	this.invertYAxis = config.invertYAxis || false;
	this.gridColor = config.gridColor || "#DFDFDF";
	this.markerLineWidth = config.markerLineWidth || 1;
	this.markerRadius = config.markerRadius || 3.0;
	this.xTicksPerPixel = config.xTicksPerPixel || 1.0/92.0;
	this.yTicksPerPixel = config.yTicksPerPixel || 1.0/40.0;
	this.minCanvasWidth = config.minCanvasWidth || 250;
	this.minCanvasHeight = config.minCanvasHeight || 150;
	this.legendMargin = config.legendMargin || 10;
	this.legendXPadding = config.legendXPadding || 5;
	this.legendYPadding = config.legendYPadding || 6;
	this.legendLineHeight = config.legendLineHeight || 11;
	this.margin = config.plotMargins || {top: 20, right: 20, bottom: (this.xAxisLabelText.length > 0 ? 60 : 30), left: (this.yAxisLabelText.length > 0 ? 65 : 50)};
	this.showTooltips = (config.hasOwnProperty("showTooltips") ? config.showTooltips : true);
	this.tooltipRadiusSquared = config.tooltipRadius || 5.5;
	this.tooltipRadiusSquared *= this.tooltipRadiusSquared;
	//this.enableValueSelection = config.enableValueSelection || false;

	this.totalWidth = Math.max(this.minCanvasWidth, canvasDimensions[0]);
	this.totalHeight = Math.max(this.minCanvasHeight, canvasDimensions[1]);
	this.width = this.totalWidth - this.margin.left - this.margin.right;
	this.height = this.totalHeight - this.margin.top - this.margin.bottom;

	this.div = this.parent.append("div")
		.attr("class", "cvpChart")
		.style("width", this.totalWidth+"px")
		.style("height", this.totalHeight+"px");
	this.d3Canvas = this.div.append("canvas")
		.attr("class", "cvpCanvas")
		.attr("width", this.width)
		.attr("height", this.height)
		.style("padding", this.margin.top + "px " + this.margin.right + "px " + this.margin.bottom + "px " + this.margin.left + "px");
	this.canvas = this.d3Canvas.node().getContext("2d");
	this.svg = this.div.append("svg")
		.attr("class", "cvpSVG")
		.attr("width", this.totalWidth)
		.attr("height", this.totalHeight);
	this.svgTranslateGroup = this.svg.append("g")
		.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

	this.xScale = null;
	this.yScale = null;
	this.xAxis = null;
	this.yAxis = null;
	this.setupXScaleAndAxis();
	this.setupYScaleAndAxis();

	this.yAxisGroup = this.svgTranslateGroup.append("g")
		.attr("class", "y cvpAxis")
		.call(this.yAxis);
	this.xAxisGroup = this.svgTranslateGroup.append("g")
		.attr("class", "x cvpAxis")
		.attr("transform", "translate(0,"+this.height+")")
		.call(this.xAxis);

	this.xAxisLabel = null;
	this.yAxisLabel = null;
	if(this.xAxisLabelText.length > 0) {
		this.xAxisLabel = this.svgTranslateGroup.append("text")
			.attr("class", "cvpLabel")
			.attr("x", Math.round(0.5*this.width))
			.attr("y", this.height + 40)
			.attr("text-anchor", "middle")
			.text(this.xAxisLabelText);
	}
	if(this.yAxisLabelText.length > 0) {
		this.yAxisLabel = this.svg.append("text")
			.attr("class", "cvpLabel")
			.attr("x", Math.round(-0.5*this.height - this.margin.top))
			.attr("y", 15)
			.attr("transform", "rotate(-90)")
			.attr("text-anchor", "middle")
			.text(this.yAxisLabelText);
	}
	this.tooltip = null;
	this.legend = null;
	this.legendBG = null;
	this.legendWidth = 0;

	//this.updateDisplayIndices();
	this.drawCanvas();

	this.zoomListener = d3.behavior.zoom()
		.on("zoom", (function() {
			//console.log("Zoom: " + d3.event.scale + ", x=" + d3.event.translate[0] + ", y="+d3.event.translate[1]);
			if(this.updateViewCallback) {
				this.updateViewCallback(this, this.xScale.domain(), this.yScale.domain());
			}
			this.updateDisplayIndices();
			this.redrawCanvasAndAxes();
			if(this.showTooltips) {
				this.updateTooltip();
			}
		}).bind(this));
	this.zoomListener(this.div);

	if(this.showTooltips) {
		this.div.on("mousemove", (this.updateTooltip).bind(this));
	}

	this.xAxisZoom = true;
	this.yAxisZoom = true;
	this.resetZoomListenerAxes();
}

// public interface

CanvasDataPlot.prototype.addDataSet = function(uniqueID, label, dataSet, colorString, updateDomains, copyData) {
	this.dataIDs.push(uniqueID);
	this.dataLabels.push(label);
	this.dataColors.push(colorString);
	this.displayIndexStart.push(0);
	this.displayIndexEnd.push(0);
	dataSet = dataSet || [];
	if(copyData) {
		var dataIndex = this.data.length;
		this.data.push([]);
		var dataSetLength = dataSet.length;
		for(var i=0; i<dataSetLength; ++i) {
			this.data[dataIndex].push(dataSet[i].slice(0));
		}
	}
	else {
		this.data.push(dataSet);
	}

	this.updateLegend();

	if(updateDomains) {
		this.updateDomains(this.calculateXDomain(), this.calculateYDomain(), true);
	}
	else {
		this.updateDisplayIndices();
		this.drawCanvas();
	}
};

CanvasDataPlot.prototype.addDataPoint = function(uniqueID, dataPoint, updateDomains, copyData) {
	var i = this.dataIDs.indexOf(uniqueID);
	if(i < 0 || (this.data[i].length > 0 && this.data[i][this.data[i].length-1][0] > dataPoint[0])) {
		return;
	}
	this.data[i].push(copyData ? dataPoint.slice(0) : dataPoint);
	
	if(updateDomains) {
		this.updateDomains(this.calculateXDomain(), this.calculateYDomain(), true);
	}
	else {
		this.updateDisplayIndices();
		this.drawCanvas();
	}
};

CanvasDataPlot.prototype.removeDataSet = function(uniqueID) {
	var index = this.dataIDs.indexOf(uniqueID);
	if(index >= 0) {
		this.data.splice(index, 1);
		this.dataIDs.splice(index, 1);
		this.dataLabels.splice(index, 1);
		this.displayIndexStart.splice(index, 1);
		this.displayIndexEnd.splice(index, 1);
		this.dataColors.splice(index, 1);

		this.updateLegend();
		this.drawCanvas();
	}
};

CanvasDataPlot.prototype.setZoomXAxis = function(zoomX) {
	if(this.xAxisZoom == zoomX) {
		return;
	}
	this.xAxisZoom = zoomX;
	this.resetZoomListenerAxes();
};

CanvasDataPlot.prototype.setZoomYAxis = function(zoomY) {
	if(this.yAxisZoom == zoomY) {
		return;
	}
	this.yAxisZoom = zoomY;
	this.resetZoomListenerAxes();
};

CanvasDataPlot.prototype.resize = function(dimensions) {
	this.totalWidth = Math.max(this.minCanvasWidth, dimensions[0]);
	this.totalHeight = Math.max(this.minCanvasHeight, dimensions[1]);
	this.width = this.totalWidth - this.margin.left - this.margin.right;
	this.height = this.totalHeight - this.margin.top - this.margin.bottom;
	this.div.style("width", this.totalWidth+"px")
		.style("height", this.totalHeight+"px");
	this.d3Canvas.attr("width", this.width)
		.attr("height", this.height);
	this.svg.attr("width", this.totalWidth)
		.attr("height", this.totalHeight);
	this.xScale.range([0, this.width]);
	this.yScale.range([this.height, 0]);
	this.xAxis
		.ticks(Math.round(this.xTicksPerPixel*this.width));
	this.yAxis
		.ticks(Math.round(this.yTicksPerPixel*this.height));
	this.xAxisGroup
		.attr("transform", "translate(0,"+this.height+")");
	if(this.xAxisLabel) {
		this.xAxisLabel
			.attr("x", Math.round(0.5*this.width))
			.attr("y", this.height + 40);
	}
	if(this.yAxisLabel) {
		this.yAxisLabel
			.attr("x", Math.round(-0.5*this.height - this.margin.top));
	}
	if(this.legend) {
		this.legend
			.attr("transform", "translate("+(this.width - this.legendWidth - this.legendMargin)+", "+this.legendMargin+")");
	}

	this.updateDisplayIndices();
	this.resetZoomListenerAxes();
	this.redrawCanvasAndAxes();
};

CanvasDataPlot.prototype.updateDomains = function(xDomain, yDomain, makeItNice) {
	this.xScale.domain(xDomain);
	this.yScale.domain(yDomain);
	if(makeItNice) {
		this.xScale.nice();
		this.yScale.nice();
	}

	this.updateDisplayIndices();
	this.resetZoomListenerAxes();
	this.redrawCanvasAndAxes();
};

CanvasDataPlot.prototype.getXDomain = function() {
	return this.xScale.domain();
};

CanvasDataPlot.prototype.getYDomain = function() {
	return this.yScale.domain();
};

CanvasDataPlot.prototype.calculateXDomain = function() {
	var nonEmptySets = [];
	this.data.forEach(function(ds) {
		if(ds && ds.length > 0) {
			nonEmptySets.push(ds);
		}
	});
	
	if(nonEmptySets.length < 1) {
		return [0, 1];
	}

	var min = nonEmptySets[0][0][0];
	var max = nonEmptySets[0][nonEmptySets[0].length-1][0];
	for(var i=1; i<nonEmptySets.length; ++i) {
		var minCandidate = nonEmptySets[i][0][0];
		var maxCandidate = nonEmptySets[i][nonEmptySets[i].length-1][0];
		min = minCandidate < min ? minCandidate : min;
		max = max < maxCandidate ? maxCandidate : max;
	}
	if(max-min <= 0) {
		min = 1*max; //NOTE: 1* is neceseccary to handle Dates in derived classes.
		max = min+1;
	}
	return [min, max];
};

CanvasDataPlot.prototype.calculateYDomain = function() {
	var nonEmptySets = [];
	this.data.forEach(function(ds) {
		if(ds && ds.length > 0) {
			nonEmptySets.push(ds);
		}
	});
	
	if(nonEmptySets.length < 1) {
		return [0, 1];
	}

	var min = d3.min(nonEmptySets[0], function(d) { return d[1]; });
	var max = d3.max(nonEmptySets[0], function(d) { return d[1]; });
	for(var i=1; i<nonEmptySets.length; ++i) {
		min = Math.min(min, d3.min(nonEmptySets[i], function(d) { return d[1]; }));
		max = Math.max(max, d3.max(nonEmptySets[i], function(d) { return d[1]; }));
	}
	if(max-min <= 0) {
		min = max-1;
		max += 1;
	}
	return [min, max];
};

CanvasDataPlot.prototype.destroy = function() {
	this.div.remove();
};

// private methods

CanvasDataPlot.prototype.setupXScaleAndAxis = function() {
	this.xScale = d3.scale.linear()
		.domain(this.calculateXDomain())
		.range([0, this.width])
		.nice();

	this.xAxis = d3.svg.axis()
		.scale(this.xScale)
		.orient("bottom")
		.ticks(Math.round(this.xTicksPerPixel*this.width));
};

CanvasDataPlot.prototype.setupYScaleAndAxis = function() {
	this.yScale = d3.scale.linear()
		.domain(this.calculateYDomain())
		.range(this.invertYAxis ? [0, this.height] : [this.height, 0])
		.nice();

	this.yAxis = d3.svg.axis()
		.scale(this.yScale)
		.orient("left")
		.ticks(Math.round(this.yTicksPerPixel*this.height));
};

CanvasDataPlot.prototype.getDataID = function(index) {
	return (this.dataIDs.length > index ? this.dataIDs[index] : "");
};

CanvasDataPlot.prototype.updateTooltip = function() {
	var mouse = d3.mouse(this.div.node());
	var mx = mouse[0] - this.margin.left;
	var my = mouse[1] - this.margin.top;
	if(mx <= 0 || mx >= this.width || my <= 0 || my >= this.height) {
		this.removeTooltip();
		return;
	}

	var nDataSets = this.data.length;
	var hitMarker = false;
	CanvasDataPlot_updateTooltip_graph_loop:
	for(var i=0; i<nDataSets; ++i) {
		var d = this.data[i];
		var iStart = this.displayIndexStart[i];
		var iEnd = Math.min(d.length-1, this.displayIndexEnd[i]+1);
		for(var j=iStart; j<=iEnd; ++j) {
			var dx = this.xScale(d[j][0]) - mx;
			var dy = this.yScale(d[j][1]) - my;
			if(dx*dx + dy*dy <= this.tooltipRadiusSquared) {
				hitMarker = true;
				this.showTooltip([this.xScale(d[j][0]), this.yScale(d[j][1])], this.dataColors[i], this.getTooltipStringX(d[j]), this.getTooltipStringY(d[j]));
				break CanvasDataPlot_updateTooltip_graph_loop;
			}
		}
	}
	if(!hitMarker){
		this.removeTooltip();
	}
};

CanvasDataPlot.prototype.getTooltipStringX = function(dataPoint) {
	return "x = "+dataPoint[0];
};

CanvasDataPlot.prototype.getTooltipStringY = function(dataPoint) {
	return "y = "+dataPoint[1];
};

CanvasDataPlot.prototype.showTooltip = function(position, color, xText, yText) {
	if(this.tooltip) {
		this.tooltip.remove();
		this.tooltip = null;
	}

	this.tooltip = this.svgTranslateGroup.append("g")
		.attr("class", "cvpTooltip")
		.attr("transform", "translate("+position[0]+", "+(position[1] - this.markerRadius - 2)+")");
	var tooltipBG = this.tooltip.append("path")
		.attr("class", "cvpTooltipBG")
		.attr("d", "M0 0 L-10 -10 L-100 -10 L-100 -45 L100 -45 L100 -10 L10 -10 Z")
		.attr("stroke", color)
		.attr("vector-effect", "non-scaling-stroke");
	var xTextElem = this.tooltip.append("text")
		.attr("x", 0)
		.attr("y", -32)
		.attr("text-anchor", "middle")
		.text(xText);
	var yTextElem = this.tooltip.append("text")
		.attr("x", 0)
		.attr("y", -15)
		.attr("text-anchor", "middle")
		.text(yText);
	tooltipBG.attr("transform", "scale("+(1.1*Math.max(xTextElem.node().getComputedTextLength(), yTextElem.node().getComputedTextLength())/200)+",1)");
};

CanvasDataPlot.prototype.removeTooltip = function() {
	if(!this.tooltip) {
		return;
	}
	this.tooltip.remove();
	this.tooltip = null;
};

CanvasDataPlot.prototype.updateLegend = function() {
	if(this.disableLegend) {
		return;
	}
	if(this.legend) {
		this.legend.remove();
		this.legend = null;
		this.legendWidth = 0;
	}
	if(this.data.length == 0) {
		return;
	}

	this.legend = this.svgTranslateGroup.append("g")
		.attr("class", "cvpLegend")
		.attr("transform", "translate("+(this.width + this.margin.right + 1)+", "+this.legendMargin+")");
	this.legendBG = this.legend.append("rect")
		.attr("class", "cvpLegendBG")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", 250)
		.attr("height", this.legendYPadding + this.dataLabels.length*(this.legendYPadding+this.legendLineHeight) - 1);

	var maxTextLen = 0;
	this.dataLabels.forEach((function(d, i) {
		this.legend.append("rect")
			.attr("x", this.legendXPadding)
			.attr("y", this.legendYPadding + i*(this.legendYPadding+this.legendLineHeight))
			.attr("width", this.legendLineHeight)
			.attr("height", this.legendLineHeight)
			.attr("fill", this.dataColors[i])
			.attr("stroke", "none");
		var textElem = this.legend.append("text")
			.attr("x", 2*this.legendXPadding + this.legendLineHeight - 1)
			.attr("y", this.legendYPadding + this.legendLineHeight + i*(this.legendYPadding+this.legendLineHeight) - 1)
			.text(this.dataLabels[i].length > 0 ? this.dataLabels[i] : this.dataIDs[i]);
		maxTextLen = Math.max(maxTextLen, textElem.node().getComputedTextLength());
	}).bind(this));
	this.legendWidth = 3*this.legendXPadding + this.legendLineHeight + maxTextLen - 1;
	this.legendBG.attr("width", this.legendWidth);
	this.legend
		.attr("transform", "translate("+(this.width - this.legendWidth - this.legendMargin)+", "+this.legendMargin+")");
};

CanvasDataPlot.prototype.findLargestSmaller = function(d, ia, ib, v) {
	if(this.xScale(d[ia][0]) >= v || ib-ia <= 1) {
		return ia;
	}

	var imiddle = Math.floor(0.5*(ia+ib));

	return this.xScale(d[imiddle][0]) <= v ? this.findLargestSmaller(d, imiddle, ib, v) : this.findLargestSmaller(d, ia, imiddle, v);
};

CanvasDataPlot.prototype.updateDisplayIndices = function() {
	var nDataSets = this.data.length;
	for(var i=0; i<nDataSets; ++i) {
		var d = this.data[i];
		if(d.length < 1) {
			continue;
		}
		var iStart = this.findLargestSmaller(d, 0, d.length-1, 0);
		var iEnd = this.findLargestSmaller(d, iStart, d.length-1, this.width);
		this.displayIndexStart[i] = iStart;
		this.displayIndexEnd[i] = iEnd;
	}
};

CanvasDataPlot.prototype.redrawCanvasAndAxes = function() {
	this.xAxisGroup.call(this.xAxis);
	this.yAxisGroup.call(this.yAxis);
	this.drawCanvas();
};

CanvasDataPlot.prototype.drawCanvas = function() {
	this.canvas.clearRect(0, 0, this.width, this.height);

	this.drawGrid();

	var nDataSets = this.data.length;
	for(var i=0; i<nDataSets; ++i) {
		this.drawDataSet(i);
	}
};

CanvasDataPlot.prototype.drawGrid = function() {
	this.canvas.lineWidth = 1;
	this.canvas.strokeStyle = this.gridColor;
	this.canvas.beginPath();
	this.yScale.ticks(this.yAxis.ticks()[0])
		.map((function(d) { return Math.floor(this.yScale(d))+0.5; }).bind(this))
		.forEach((function(d) {
			this.canvas.moveTo(0, d);
			this.canvas.lineTo(this.width, d);
		}).bind(this));
	this.xScale.ticks(this.xAxis.ticks()[0])
		.map((function(d) { return Math.floor(this.xScale(d))+0.5; }).bind(this))
		.forEach((function(d) {
			this.canvas.moveTo(d, 0);
			this.canvas.lineTo(d, this.height);
		}).bind(this));
	this.canvas.stroke();
};

CanvasDataPlot.prototype.drawDataSet = function(dataIndex) {
	var d = this.data[dataIndex];
	if(d.length < 1) {
		return;
	}
	var iStart = this.displayIndexStart[dataIndex];
	var iEnd = this.displayIndexEnd[dataIndex];
	var iLast = Math.min(d.length-1 , iEnd+1);

	this.canvas.strokeStyle = this.dataColors[dataIndex];
	this.canvas.lineWidth = this.markerLineWidth;
	for(var i=iStart; i<=iLast; ++i) {
		this.canvas.beginPath();
		this.canvas.arc(this.xScale(d[i][0]), this.yScale(d[i][1]),
			this.markerRadius, 0, 2*Math.PI);
		this.canvas.stroke();
	}
};

CanvasDataPlot.prototype.resetZoomListenerAxes = function() {
	this.zoomListener
		.x(this.xAxisZoom ? this.xScale : d3.scale.linear().domain([0,1]).range([0,1]))
		.y(this.yAxisZoom ? this.yScale : d3.scale.linear().domain([0,1]).range([0,1]));
};

CanvasDataPlot.prototype.updateZoomValues = function(scale, translate) {
	this.zoomListener
		.scale(scale)
		.translate(translate);
	this.updateDisplayIndices();
	this.redrawCanvasAndAxes();
};

function CanvasPlot_shallowObjectCopy(inObj) {
	var original = inObj || {};
	var keys = Object.getOwnPropertyNames(original);
	var outObj = {};
	keys.forEach(function(k) {
		outObj[k] = original[k];
	});
	return outObj;
}
function CanvasPlot_appendToObject(obj, objToAppend) {
	Object.keys(objToAppend).forEach(function(k) {
		if(!obj.hasOwnProperty(k)) {
			obj[k] = objToAppend[k];
		}
		else {
			if(obj[k] !== null && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
				appendToObject(obj[k], objToAppend[k]);
			}
			else if(Array.isArray(obj[k]) && Array.isArray(objToAppend[k])) {
				objToAppend[k].forEach(function(d) {
					if(obj[k].indexOf(d) < 0) {
						obj[k].push(d);
					}
				});
			}
		}
	});
}



function CanvasTimeSeriesPlot(parentElement, canvasDimensions, config) {
	config = config || {};

	this.informationDensity = [];

	this.plotLineWidth = config.plotLineWidth || 1;
	this.maxInformationDensity = config.maxInformationDensity || 2.0;
	this.showMarkerDensity = config.showMarkerDensity || 0.14;

	CanvasDataPlot.call(this, parentElement, canvasDimensions, config);
}
CanvasTimeSeriesPlot.prototype = Object.create(CanvasDataPlot.prototype);

CanvasTimeSeriesPlot.prototype.addDataSet = function(uniqueID, label, dataSet, colorString, updateDomains, copyData) {
	this.informationDensity.push(1);
	CanvasDataPlot.prototype.addDataSet.call(this, uniqueID, label, dataSet, colorString, updateDomains, copyData);
};

CanvasTimeSeriesPlot.prototype.removeDataSet = function(uniqueID) {
	var index = this.dataIDs.indexOf(uniqueID);
	if(index >= 0) {
		this.informationDensity.splice(index, 1);
	}
	CanvasDataPlot.prototype.removeDataSet.call(this, uniqueID);
};

CanvasTimeSeriesPlot.prototype.updateDisplayIndices = function() {
	CanvasDataPlot.prototype.updateDisplayIndices.call(this);

	var nDataSets = this.data.length;
	for(var i=0; i<nDataSets; ++i) {
		var d = this.data[i];
		if(d.length < 1) {
			continue;
		}
		var iStart = this.displayIndexStart[i];
		var iEnd = this.displayIndexEnd[i];
		var iLength = iEnd - iStart + 1;
		var scaleLength =  Math.max(1, this.xScale(d[iEnd][0]) - this.xScale(d[iStart][0]));
		this.informationDensity[i] = iLength/scaleLength;
	}
};

CanvasTimeSeriesPlot.prototype.updateTooltip = function() {
	var mouse = d3.mouse(this.div.node());
	var mx = mouse[0] - this.margin.left;
	var my = mouse[1] - this.margin.top;
	if(mx <= 0 || mx >= this.width || my <= 0 || my >= this.height) {
		this.removeTooltip();
		return;
	}

	var nDataSets = this.data.length;
	var hitMarker = false;
	TimeSeriesPlot_updateTooltip_graph_loop:
	for(var i=0; i<nDataSets; ++i) {
		if(this.informationDensity[i] > this.showMarkerDensity) {
			continue;
		}
		var d = this.data[i];
		var iStart = this.displayIndexStart[i];
		var iEnd = Math.min(d.length-1, this.displayIndexEnd[i]+1);
		for(var j=iStart; j<=iEnd; ++j) {
			var dx = this.xScale(d[j][0]) - mx;
			var dy = this.yScale(d[j][1]) - my;
			if(dx*dx + dy*dy <= this.tooltipRadiusSquared) {
				hitMarker = true;
				this.showTooltip([this.xScale(d[j][0]), this.yScale(d[j][1])], this.dataColors[i], this.getTooltipStringX(d[j]), this.getTooltipStringY(d[j]));
				break TimeSeriesPlot_updateTooltip_graph_loop;
			}
		}
	}
	if(!hitMarker){
		this.removeTooltip();
	}
};

CanvasTimeSeriesPlot.prototype.getTooltipStringX = function(dataPoint) {
	var zeroPad2 = function(n) {
		return n<10 ? ("0"+n) : n.toString();
	};
	var date = dataPoint[0];
	var Y = date.getUTCFullYear();
	var M = zeroPad2(date.getUTCMonth());
	var D = zeroPad2(date.getUTCDay());
	var h = zeroPad2(date.getUTCHours());
	var m = zeroPad2(date.getUTCMinutes());
	var s = zeroPad2(date.getUTCSeconds());
	return Y+"-"+M+"-"+D+" "+h+":"+m+":"+s;
};

CanvasTimeSeriesPlot.prototype.setupXScaleAndAxis = function() {
	this.xScale = d3.time.scale.utc()
		.domain(this.calculateXDomain())
		.range([0, this.width])
		.nice();

	this.customTimeFormat = d3.time.format.utc.multi([
		[".%L", function(d) { return d.getUTCMilliseconds(); }],
		[":%S", function(d) { return d.getUTCSeconds(); }],
		//["%I:%M", function(d) { return d.getUTCMinutes(); }],
		["%H:%M", function(d) { return d.getUTCHours() + d.getUTCMinutes(); }],
		//["%a %d", function(d) { return d.getUTCDay() && d.getUTCDate() != 1; }],
		["%b %d", function(d) { return d.getUTCDate() != 1; }],
		["%B '%y", function(d) { return d.getUTCMonth(); }],
		["%Y", function() { return true; }]
	]);

	this.xAxis = d3.svg.axis()
		.scale(this.xScale)
		.orient("bottom")
		.tickFormat(this.customTimeFormat)
		.ticks(Math.round(this.xTicksPerPixel*this.width));
};

CanvasTimeSeriesPlot.prototype.drawDataSet = function(dataIndex) {
	var d = this.data[dataIndex];
	if(d.length < 1) {
		return;
	}
	var iStart = this.displayIndexStart[dataIndex];
	var iEnd = this.displayIndexEnd[dataIndex];
	var informationDensity = this.informationDensity[dataIndex];

	var drawEvery = 1;
	if(informationDensity > this.maxInformationDensity) {
		drawEvery = Math.floor(informationDensity / this.maxInformationDensity);
	}

	// Make iStart divisivble by drawEvery to prevent flickering graphs while panning
	iStart = Math.max(0, iStart - iStart%drawEvery);

	this.canvas.beginPath();
	this.canvas.moveTo(this.xScale(d[iStart][0]), this.yScale(d[iStart][1]));
	for(var i=iStart; i<=iEnd; i=i+drawEvery) {
		this.canvas.lineTo(this.xScale(d[i][0]),
			this.yScale(d[i][1]));
	}
	var iLast = Math.min(d.length-1 , iEnd+drawEvery);
	this.canvas.lineTo(this.xScale(d[iLast][0]),
		this.yScale(d[iLast][1]));
	this.canvas.lineWidth = this.plotLineWidth;
	this.canvas.strokeStyle = this.dataColors[dataIndex];
	this.canvas.stroke();

	if(informationDensity <= this.showMarkerDensity) {
		this.canvas.lineWidth = this.markerLineWidth;
		for(var i=iStart; i<=iLast; ++i) {
			this.canvas.beginPath();
			this.canvas.arc(this.xScale(d[i][0]), this.yScale(d[i][1]),
				this.markerRadius, 0, 2*Math.PI);
			this.canvas.stroke();
		}
	}
};



function CanvasVectorSeriesPlot(parentElement, canvasDimensions, config) {
	// Data element format: [Date, y value, direction, magnitude]

	this.vectorScale = config.vectorScale || 2.0e5;
	this.scaleUnits = config.scaleUnits || "units";
	this.scaleLength = config.scaleLength || 75;
	this.scaleTextElem = null;
	
	var configCopy = CanvasPlot_shallowObjectCopy(config);
	//configCopy["showTooltips"] = false;
	if(!("invertYAxis" in configCopy)) {
		configCopy["invertYAxis"] = true;
	}
	
	CanvasTimeSeriesPlot.call(this, parentElement, canvasDimensions, configCopy);
}
CanvasVectorSeriesPlot.prototype = Object.create(CanvasTimeSeriesPlot.prototype);

//CanvasVectorSeriesPlot.prototype.updateTooltip = function() {
//	//TODO
//};

CanvasVectorSeriesPlot.prototype.getTooltipStringY = function(dataPoint) {
	var roundConst = 100;
	var dir = Math.round(roundConst * 180/Math.PI * (dataPoint[2] % (2*Math.PI))) / roundConst;
	var mag = Math.round(roundConst * dataPoint[3]) / roundConst;
	return "y = " + dataPoint[1] + "; dir = " + dir + "; mag = " + mag;
};

CanvasVectorSeriesPlot.prototype.getMagnitudeScale = function() {
	var xDomain = this.getXDomain();
	return this.vectorScale * this.width / (xDomain[1] - xDomain[0]);
};

CanvasVectorSeriesPlot.prototype.drawCanvas = function() {
	this.updateScaleText();
	CanvasTimeSeriesPlot.prototype.drawCanvas.call(this);
}

CanvasVectorSeriesPlot.prototype.drawDataSet = function(dataIndex) {
	var d = this.data[dataIndex];
	if(d.length < 1) {
		return;
	}
	var iStart = this.displayIndexStart[dataIndex];
	var iEnd = this.displayIndexEnd[dataIndex];
	var informationDensity = this.informationDensity[dataIndex];

	var drawEvery = 1;
	if(informationDensity > this.maxInformationDensity) {
		drawEvery = Math.floor(informationDensity / this.maxInformationDensity);
	}

	// Make iStart divisivble by drawEvery to prevent flickering graphs while panning
	iStart = Math.max(0, iStart - drawEvery - iStart%drawEvery);
	iEnd = Math.min(d.length-1 , iEnd+drawEvery)

	this.canvas.lineWidth = this.plotLineWidth;
	this.canvas.strokeStyle = this.dataColors[dataIndex];
	var magScale = this.getMagnitudeScale();
	var tipSize = 10*magScale;
	for(var i=iStart; i<=iEnd; i=i+drawEvery) {
		var startX = this.xScale(d[i][0]);
		var startY = this.yScale(d[i][1]);
		var dir = -1.0*d[i][2] + 0.5*Math.PI;
		var mag = magScale*d[i][3];
		
		var cosDir = Math.cos(dir);
		var sinDir = Math.sin(dir);
		
		var endX = startX+mag*cosDir;
		var endY = startY-mag*sinDir;
		
		//var tipAngle = 0.1*Math.PI;
		this.canvas.beginPath();
		this.canvas.moveTo(startX, startY);
		this.canvas.lineTo(endX, endY);
		this.canvas.stroke();
		
		this.canvas.beginPath();
		this.canvas.moveTo(startX+(mag-tipSize)*cosDir - 0.5*tipSize*sinDir,
			startY-((mag-tipSize)*sinDir + 0.5*tipSize*cosDir));
		this.canvas.lineTo(endX, endY);
		this.canvas.lineTo(startX+(mag-tipSize)*cosDir + 0.5*tipSize*sinDir,
			startY-((mag-tipSize)*sinDir - 0.5*tipSize*cosDir));
		this.canvas.stroke();
	}

	//if(informationDensity <= this.showMarkerDensity) {
	//	this.canvas.lineWidth = this.markerLineWidth;
	//	for(var i=iStart; i<=iLast; ++i) {
	//		this.canvas.beginPath();
	//		this.canvas.arc(this.xScale(d[i][0]), this.yScale(d[i][1]),
	//			this.markerRadius, 0, 2*Math.PI);
	//		this.canvas.stroke();
	//	}
	//}
};

CanvasVectorSeriesPlot.prototype.updateScaleText = function() {
	if(this.disableLegend || !this.scaleTextElem) {
		return;
	}
	var newLabel = (this.scaleLength/this.getMagnitudeScale()).toFixed(1) + this.scaleUnits;
	this.scaleTextElem.text(newLabel);
	var newLength = this.scaleTextElem.node().getComputedTextLength() + this.scaleLength + 3*this.legendXPadding;
	var lengthDiff = this.legendWidth - newLength; 
	if(lengthDiff < 0) {
		this.legendWidth -= lengthDiff;
		this.legendBG.attr("width", this.legendWidth);
		this.legend
			.attr("transform", "translate("+(this.width - this.legendWidth - this.legendMargin)+", "+this.legendMargin+")");
	}
};

CanvasVectorSeriesPlot.prototype.updateLegend = function() {
	if(this.disableLegend) {
		return;
	}
	CanvasDataPlot.prototype.updateLegend.call(this);

	if(!this.legend) {
		return;
	}

	var oldHeight = parseInt(this.legendBG.attr("height"));
	var newHeight = oldHeight + this.legendYPadding + this.legendLineHeight;
	this.legendBG.attr("height", newHeight);

	this.legend.append("rect")
			.attr("x", this.legendXPadding)
			.attr("y", newHeight - Math.floor((this.legendYPadding+0.5*this.legendLineHeight)) + 1)
			.attr("width", this.scaleLength)
			.attr("height", 2)
			.attr("fill", "black")
			.attr("stroke", "none");
	this.scaleTextElem = this.legend.append("text")
			.attr("x", 2*this.legendXPadding + this.scaleLength)
			.attr("y", newHeight - this.legendYPadding);
	this.updateScaleText();
};





function CanvasDataPlotGroup(parentElement, plotDimensions, multiplePlots, syncPlots, defaultConfig) {
	this.defaultConfig = CanvasPlot_shallowObjectCopy(defaultConfig);
	this.container = parentElement;
	this.width = plotDimensions[0];
	this.height = plotDimensions[1];
	this.plots = [];
	this.firstPlotType = "";
	this.multiplePlots = multiplePlots;
	this.syncPlots = syncPlots;
	this.syncTranslateX = true;
	this.syncTranslateY = true;
	this.lastZoomedPlot = null;
	this.zoomXAxis = true;
	this.zoomYAxis = true;
	
	this.defaultConfig["updateViewCallback"] = (this.multiplePlots ? (this.setViews).bind(this) : null);
}

// public interface

CanvasDataPlotGroup.prototype.addDataSet = function(plotType, uniqueID, displayName, dataSet, color, plotConfig) {
	if(this.multiplePlots || this.plots.length < 1) {
		var config = null;
		if(plotConfig) {
			config = CanvasPlot_shallowObjectCopy(plotConfig);
			CanvasPlot_appendToObject(config, this.defaultConfig);
		}
		else {
			config = this.defaultConfig;
		}
		if(plotConfig && this.multiplePlots) {
			config["updateViewCallback"] = (this.setViews).bind(this);
		}
		var p = this.createPlot(plotType, config);
		p.addDataSet(uniqueID, displayName, dataSet, color, false);
		p.setZoomXAxis(this.zoomXAxis);
		p.setZoomYAxis(this.zoomYAxis);
		this.plots.push(p);
		this.firstPlotType = plotType;
		this.fitDataInViews();
	}
	else if(plotType === this.firstPlotType) {
		this.plots[0].addDataSet(uniqueID, displayName, dataSet, color, true);
	}
};

CanvasDataPlotGroup.prototype.removeDataSet = function(uniqueID) {
	if(this.multiplePlots) {
		var nPlots = this.plots.length;
		for(var i=0; i<nPlots; ++i) {
			if(this.plots[i].getDataID(0) === uniqueID) {
				if(this.lastZoomedPlot === this.plots[i]) {
					this.lastZoomedPlot = null;
				}
				this.plots[i].destroy();
				this.plots.splice(i, 1);
				break;
			}
		}
	}
	else if(this.plots.length > 0) {
		this.plots[0].removeDataSet(uniqueID);
	}
};

CanvasDataPlotGroup.prototype.setSyncViews = function(sync, translateX, translateY) {
	this.syncPlots = sync;
	this.syncTranslateX = translateX;
	this.syncTranslateY = translateY;
	if(sync) {
		if(this.lastZoomedPlot) {
			var xDomain = this.lastZoomedPlot.getXDomain();
			var yDomain = this.lastZoomedPlot.getYDomain();
			this.plots.forEach((function(p) {
				if(p != this.lastZoomedPlot) {
					p.updateDomains(this.syncTranslateX ? xDomain : p.getXDomain(),
						this.syncTranslateY ? yDomain : p.getYDomain(),
						false);
				}
			}).bind(this));
		}
		else {
			this.fitDataInViews();
		}
	}
};

CanvasDataPlotGroup.prototype.setZoomXAxis = function(zoomX) {
	this.zoomXAxis = zoomX;
	this.plots.forEach(function(p) {
		p.setZoomXAxis(zoomX);
	});
};

CanvasDataPlotGroup.prototype.setZoomYAxis = function(zoomY) {
	this.zoomYAxis = zoomY;
	this.plots.forEach(function(p) {
		p.setZoomYAxis(zoomY);
	});
};

CanvasDataPlotGroup.prototype.fitDataInViews = function() {
	if(this.plots.length < 1) {
		return;
	}

	var xDomain = this.plots[0].calculateXDomain();
	var yDomain = this.plots[0].calculateYDomain();

	for(var i=1; i<this.plots.length; ++i) {
		var xDomainCandidate = this.plots[i].calculateXDomain();
		var yDomainCandidate = this.plots[i].calculateYDomain();
		if(xDomainCandidate[0] < xDomain[0]) { xDomain[0] = xDomainCandidate[0]; }
		if(xDomainCandidate[1] > xDomain[1]) { xDomain[1] = xDomainCandidate[1]; }
		if(yDomainCandidate[0] < yDomain[0]) { yDomain[0] = yDomainCandidate[0]; }
		if(yDomainCandidate[1] > yDomain[1]) { yDomain[1] = yDomainCandidate[1]; }
	}

	this.plots.forEach(function(p) {
		p.updateDomains(xDomain, yDomain, true);
	});
};

CanvasDataPlotGroup.prototype.resizePlots = function(dimensions) {
	this.width = dimensions[0];
	this.height = dimensions[1];
	this.plots.forEach(function(p) {
		p.resize(dimensions);
	});
};

CanvasDataPlotGroup.prototype.destroy = function() {
	this.plots.forEach(function(p) {
		p.destroy();
	});
	this.lastZoomedPlot = null;
	this.plots = [];
};

// private methods

CanvasDataPlotGroup.prototype.createPlot = function(plotType, plotConfig) {
	if(plotType === "CanvasTimeSeriesPlot") {
		return new CanvasTimeSeriesPlot(this.container, [this.width, this.height], plotConfig);
	}
	if(plotType === "CanvasVectorSeriesPlot") {
		return new CanvasVectorSeriesPlot(this.container, [this.width, this.height], plotConfig);
	}
	return new CanvasDataPlot(this.container, [this.width, this.height], plotConfig);
};

CanvasDataPlotGroup.prototype.setViews = function(except, xDomain, yDomain) {
	this.lastZoomedPlot = except;
	if(!this.syncPlots) {
		return;
	}
	this.plots.forEach((function(p) {
		if(p != except) {
			p.updateDomains(this.syncTranslateX ? xDomain : p.getXDomain(),
				this.syncTranslateY ? yDomain : p.getYDomain(),
				false);
		}
	}).bind(this));
};
