//
// CHM Data Viewer-related Javascript functions
//
// Load and view data files related to Clinched Highway Mapping (CHM)
// related academic data sets.
//
// Author: Jim Teresco, Siena College, The College of Saint Rose
//
// Code developed based on examples from
// http://cmap.m-plex.com/tools/wptedit/wptedit.html
// http://www.alecjacobson.com/weblog/?p=1645
//
// Modification History:
//
// 2011-06-20 JDT  Initial implementation
// 2011-06-21 JDT  Added .gra support and checkbox for hidden marker display
// 2011-06-23 JDT  Added .nmp file support (near-miss points)
// 2011-08-23 JDT  Added .pth file support (path)
// 2011-08-31 JDT  Added tabular graph data display
// 2013-08-14 JDT  Completed conversion to Google Maps API V3
// 2013-08-15 JDT  Added custom icon for intersections
// 2013-12-08 JDT  Fixed to handle DOS-style CRLF in uploaded files
// 2013-12-25 JDT  Click on GRA, PTH point label in table recenters map
// 2014-11-17 JDT  Added .wpl file support (waypoint list)
// 2016-06-27 JDT  Removed code duplicated by TM's tmjsfuncs.js
// 2016-06-27 JDT  Added support for .tmg graph file format
// 2016-07-14 JDT  simple .tmg format support
//

// several globals (map, waypoints, markers, etc) now come from
// tmjsfuncs.js

// loadfromqs used to be part of loadmap, likely to be replaced with
// code generated by PHP later
function loadfromqs() {

    // check for a load query string parameter
    var qs = location.search.substring(1);
    //DBG.write("qs: " + qs);
    var qsitems = qs.split('&');
    for (var i = 0; i < qsitems.length; i++) {
	//DBG.write("qsitems[" + i + "] = " + qsitems[i]);
	var qsitem = qsitems[i].split('=');
	//DBG.write("qsitem[0] = " + qsitem[0]);
	if (qsitem[0] == "load") {
	    var request = new XMLHttpRequest();
	    //DBG.write("qsitem[1] = " + qsitem[1]);
	    document.getElementById('filename').innerHTML = qsitem[1];
	    request.open("GET", qsitem[1], false);
	    request.setRequestHeader("User-Agent", navigator.userAgent);
	    request.send(null);
	    if (request.status == 200) {
		processContents(request.responseText);
	    }
	}
    }
}

// shortcut function to display errors
function pointboxErrorMsg(msg) {
    pointbox = document.getElementById("pointbox");
    selected = document.getElementById("selected");

    pointbox.innerHTML = "<table class=\"gratable\"><thead><tr><th style=\"color: red\">" + msg + "</th></thead></table>";
    selected.innerHTML = pointbox.innerHTML;

}

// when a file is selected, this will be called
function startRead() {

    // first, retrieve the selected file (as a File object)
    // which must be done before we toggle the table to force
    // the pointbox to be displayed
    var file = document.getElementById('filesel').files[0];

    // force highway data box to be displayed
    var menu = document.getElementById("showHideMenu");
    menu.options[2].selected = true;
    toggleTable();

    if (file) {
	//DBG.write("file: " + file.name);
	document.getElementById('filename').innerHTML = file.name;
	if ((file.name.indexOf(".wpt") == -1) &&
	    (file.name.indexOf(".pth") == -1) &&
	    (file.name.indexOf(".nmp") == -1) &&
	    (file.name.indexOf(".gra") == -1) &&
	    (file.name.indexOf(".tmg") == -1) &&
	    (file.name.indexOf(".wpl") == -1)) {
	    pointboxErrorMsg("Unrecognized file type!");
	    return;
	}
	pointboxErrorMsg("Loading... (" + file.size + " bytes)");
	var reader;
	try {
	    reader = new FileReader();
	}
	catch(e) {
	    pointboxErrorMsg("Error: unable to access file (Perhaps no browser support?  Try recent Firefox or Chrome releases.).");
	    return;
	}
	reader.readAsText(file, "UTF-8");
	reader.onload = fileLoaded;
	//reader.onerror = fileLoadError;
    }
    else {
	//DBG.write("file is null!");
    }
}


// when the FileReader created in startRead has finished, this will be called
// to process the contents of the file
function fileLoaded(event) {

    // file done loading, read the contents
    processContents(event.target.result);
}

// process the contents of a String which came from a file or elsewhere
function processContents(fileContents) {

    // place the contents into the file contents area (will improve later)
    document.getElementById('pointbox').innerHTML = "<pre>" + fileContents + "</pre>";
    document.getElementById('selected').innerHTML = "<pre>" + fileContents + "</pre>";

    var pointboxContents = "";

    // parse the file and process as appropriate
    // TODO: check that this is always still here when we ask, might be
    // better to store the filename in a variable for safe keeping
    var fileName = document.getElementById('filename').innerHTML;
    if (fileName.indexOf(".wpt") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Waypoint File)";
	pointboxContents = parseWPTContents(fileContents);
    }
    else if (fileName.indexOf(".pth") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Waypoint Path File)";
	pointboxContents = parsePTHContents(fileContents);
    }
    else if (fileName.indexOf(".nmp") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Near-Miss Point File)";
	pointboxContents = parseNMPContents(fileContents);
    }
    else if (fileName.indexOf(".wpl") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Waypoint List File)";
	pointboxContents = parseWPLContents(fileContents);
    }
    else if (fileName.indexOf(".gra") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Highway Graph File)";
	pointboxContents = parseGRAContents(fileContents);
    }
    else if (fileName.indexOf(".tmg") >= 0) {
	document.getElementById('filename').innerHTML = fileName + " (Highway Graph File)";
	pointboxContents = parseTMGContents(fileContents);
    }

    document.getElementById('pointbox').innerHTML = pointboxContents;
    document.getElementById('selected').innerHTML = pointboxContents;
    updateMap();

}

// in case we get an error from the FileReader
function errorHandler(evt) {

    if (evt.target.error.code == evt.target.error.NOT_READABLE_ERR) {
	// The file could not be read
	document.getElementById('filecontents').innerHTML = "Error reading file...";
    }
}

// parse the contents of a .tmg file
//
// First line specifies TMG and version number (expected to be 1.0),
// followed by the word "collapsed" (only supported option so far)
// indicating that the hidden vertices in the graph are collapsed
// into intermediate points along edges.
//
// Second line specifies the number of vertices, numV, and the number
// of edges, numE
//
// Next numV lines are a waypoint name (a String) followed by two
// floating point numbers specifying the latitude and longitude
//
// Next numE lines are vertex numbers (based on order in the file)
// that are connected by an edge followed by a String listing the
// highway names that connect those points, followed by pairs of
// floating point numbers, all space-separated, indicating the
// coordinates of any shaping points along the edge
//
function parseTMGContents(fileContents) {

    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    var header = lines[0].split(' ');
    if (header[0] != "TMG") {
	return '<table class="gratable"><thead><tr><th>Invalid TMG file (missing TMG marker on first line)</th></tr></table>';
    }
    if (header[1] != "1.0") {
	return '<table class="gratable"><thead><tr><th>Unsupported TMG file version (' + header[1] + ')</th></tr></table>';
    }
    if ((header[2] != "simple") && (header[2] != "collapsed")) {
	return '<table class="gratable"><thead><tr><th>Unsupported TMG graph format (' + header[2] + ')</th></tr></table>';
    }
    var counts = lines[1].split(' ');
    var numV = parseInt(counts[0]);
    var numE = parseInt(counts[1]);
    var summaryInfo = '<table class="gratable"><thead><tr><th>' + numV + " waypoints, " + numE + " connections.</th></tr></table>";

    var vTable = '<table class="gratable"><thead><tr><th colspan="3">Waypoints</th></tr><tr><th>#</th><th>Coordinates</th><th>Waypoint Name</th></tr></thead><tbody>';

    waypoints = new Array(numV);
    for (var i = 0; i < numV; i++) {
	var vertexInfo = lines[i+2].split(' ');
	waypoints[i] = new Waypoint(vertexInfo[0], vertexInfo[1], vertexInfo[2], "", new Array());
	vTable += '<tr id="waypoint' + i +'"><td>' + i + 
	    '</td><td>(' + parseFloat(vertexInfo[1]).toFixed(3) + ',' +
	    parseFloat(vertexInfo[2]).toFixed(3) + ')</td><td>'
	    + "<a onclick=\"javascript:LabelClick(" + i + ",'"
	    + waypoints[i].label + "\',"
	    + waypoints[i].lat + "," + waypoints[i].lon + ",0);\">"
	    + waypoints[i].label + "</a></td></tr>"
    }
    vTable += '</tbody></table>';

    var eTable = '<table class="gratable"><thead><tr><th colspan="3">Connections</th></tr><tr><th>#</th><th>Route Name(s)</th><th>Endpoints</th></tr></thead><tbody>';
    //graphEdges = new Array(numE);
    for (var i = 0; i < numE; i++) {
	var edgeInfo = lines[i+numV+2].split(' ');
	var newEdge;
	if (edgeInfo.length > 3) {
	    newEdge = new GraphEdge(edgeInfo[0], edgeInfo[1], edgeInfo[2], edgeInfo.slice(3));
	}
	else {
	    newEdge = new GraphEdge(edgeInfo[0], edgeInfo[1], edgeInfo[2], null);
	}

	// add this new edge to my endpoint vertex adjacency lists
	waypoints[newEdge.v1].edgeList.push(newEdge);
	waypoints[newEdge.v2].edgeList.push(newEdge);

	eTable += '<tr><td>' + i + '</td><td>' + edgeInfo[2] + '</td><td>'
	    + edgeInfo[0] + ':&nbsp;' + waypoints[newEdge.v1].label +
	    ' &harr; ' + edgeInfo[1] + ':&nbsp;'
	    + waypoints[newEdge.v2].label + '</td></tr>';
    }
    eTable += '</tbody></table>';
    genEdges = false;
    usingAdjacencyLists = true;
    return summaryInfo + '<p />' + vTable + '<p />' + eTable;
}

// parse the contents of a .gra file
//
// First line specifies the number of vertices, numV, and the number
// of edges, numE
// Next numV lines are a waypoint name (a String) followed by two
// floating point numbers specifying the latitude and longitude
// Next numE lines are vertex numbers (based on order in the file)
// that are connected by an edge followed by a String listing the
// highway names that connect those points
function parseGRAContents(fileContents) {

    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    var counts = lines[0].split(' ');
    var numV = parseInt(counts[0]);
    var numE = parseInt(counts[1]);
    var sideInfo = '<table class="gratable"><thead><tr><th>' + numV + " waypoints, " + numE + " connections.</th></tr></table>";

    var vTable = '<table class="gratable"><thead><tr><th colspan="3">Waypoints</th></tr><tr><th>#</th><th>Coordinates</th><th>Waypoint Name</th></tr></thead><tbody>';

    waypoints = new Array(numV);
    for (var i = 0; i < numV; i++) {
	var vertexInfo = lines[i+1].split(' ');
	waypoints[i] = new Waypoint(vertexInfo[0], vertexInfo[1], vertexInfo[2], "", "");
	vTable += '<tr><td>' + i +
	    '</td><td>(' + parseFloat(vertexInfo[1]).toFixed(3) + ',' +
	    parseFloat(vertexInfo[2]).toFixed(3) + ')</td><td>'
	    + "<a onclick=\"javascript:LabelClick(" + i + ",'"
	    + waypoints[i].label + "\',"
	    + waypoints[i].lat + "," + waypoints[i].lon + ",0);\">"
	    + waypoints[i].label + "</a></td></tr>"
    }
    vTable += '</tbody></table>';

    var eTable = '<table class="gratable"><thead><tr><th colspan="3">Connections</th></tr><tr><th>#</th><th>Route Name(s)</th><th>Endpoints</th></tr></thead><tbody>';
    graphEdges = new Array(numE);
    for (var i = 0; i < numE; i++) {
	var edgeInfo = lines[i+numV+1].split(' ');
	graphEdges[i] = new GraphEdge(edgeInfo[0], edgeInfo[1], edgeInfo[2], null);
	eTable += '<tr><td>' + i + '</td><td>' + edgeInfo[2] + '</td><td>'
	    + edgeInfo[0] + ':&nbsp;' + waypoints[graphEdges[i].v1].label +
	    ' &harr; ' + edgeInfo[1] + ':&nbsp;'
	    + waypoints[graphEdges[i].v2].label + '</td></tr>';
    }
    eTable += '</tbody></table>';
    genEdges = false;
    return sideInfo + '<p />' + vTable + '<p />' + eTable;
}

// parse the contents of a .wpt file
//
// Consists of a series of lines each containing a waypoint name
// and an OSM URL for that point's location:
//
/*
YT1_S http://www.openstreetmap.org/?lat=60.684924&lon=-135.059652
MilCanRd http://www.openstreetmap.org/?lat=60.697199&lon=-135.047250
+5 http://www.openstreetmap.org/?lat=60.705383&lon=-135.054932
4thAve http://www.openstreetmap.org/?lat=60.712623&lon=-135.050619
*/
function parseWPTContents(fileContents) {

    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    graphEdges = new Array();
    waypoints = new Array();
    for (var i = 0; i < lines.length; i++) {
	if (lines[i].length > 0) {
	    waypoints[waypoints.length] = WPTLine2Waypoint(lines[i]);
	}
    }
    genEdges = true;
    return "<h2>Raw file contents:</h2><pre>" + fileContents + "</pre>";
}

// parse the contents of a .pth file
//
// Consists of a series of lines each containing a route name, zero or
// more intermediate points (latitude, longitude pairs), then a
// waypoint name and a latitude and a longitude, all space-separated,
// or a line containing a route name and waypoint name followed by a
// lat,lng pair in parens
//
/*
START YT2@BorRd (60.862343,-135.196595)
YT2 YT2@TakHSRd (60.85705,-135.202029)
YT2 (60.849881,-135.203934) (60.844649,-135.187111) (60.830141,-135.187454) YT1_N/YT2_N (60.810264,-135.205286)
YT1,YT2 (60.79662,-135.170288) YT1/YT2@KatRd (60.788579,-135.166302)
YT1,YT2 YT1/YT2@WannRd (60.772479,-135.15044)
YT1,YT2 YT1/YT2@CenSt (60.759893,-135.141191)

or

START YT2@BorRd 60.862343 -135.196595
YT2 YT2@TakHSRd 60.85705 -135.202029
YT2 60.849881 -135.203934 60.844649 -135.187111 60.830141 -135.187454 YT1_N/YT2_N 60.810264 -135.205286
YT1,YT2 60.79662 -135.170288 YT1/YT2@KatRd 60.788579 -135.166302
YT1,YT2 YT1/YT2@WannRd 60.772479 -135.15044
YT1,YT2 YT1/YT2@CenSt 60.759893 -135.141191

*/
function parsePTHContents(fileContents) {

    var table = '<table class="pthtable"><thead><tr><th>Route</th><th>To Point</th><th>Seg.<br>Miles</th><th>Cumul.<br>Miles</th></tr></thead><tbody>';
    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    graphEdges = new Array();
    waypoints = new Array();
    var totalMiles = 0.0;
    var segmentMiles = 0.0;
    var previousWaypoint = null;
    for (var i = 0; i < lines.length; i++) {
	if (lines[i].length > 0) {
	    // standardize first
	    var line = standardizePTHLine(lines[i]);
	    var info = PTHLineInfo(line, previousWaypoint);
	    waypoints[waypoints.length] = info.waypoint;
	    totalMiles += info.mileage;
	    // this will display as a graph, so create and assign the
	    // graph edges
	    if (previousWaypoint != null) {
		var newEdge = new GraphEdge(i-1, i, info.waypoint.elabel, info.via);
		previousWaypoint.edgeList[previousWaypoint.edgeList.length] = newEdge;
		info.waypoint.edgeList[0] = newEdge;
	    }
	    previousWaypoint = info.waypoint;
	    table += '<tr><td>' + waypoints[waypoints.length-1].elabel +
		"</td><td><a onclick=\"javascript:LabelClick(" + 0 + ",\'"
	        + waypoints[waypoints.length-1].label + "\',"
	        + waypoints[waypoints.length-1].lat + "," + waypoints[waypoints.length-1].lon +
		",0);\">" + waypoints[waypoints.length-1].label +
		'</a></td><td style="text-align:right">' + info.mileage.toFixed(2) +
		'</td><td style="text-align:right">' + totalMiles.toFixed(2) +
		'</td></tr>';
	}
    }
    table += '</tbody></table>';
    //genEdges = true;
    usingAdjacencyLists = true;
    return table;
}

// parse the contents of a .nmp file
//
// Consists of a series of lines, each containing a waypoint name
// followed by two floating point numbers representing the point's
// latitude and longitude
//
// Entries are paired as "near-miss" points, and a graph edge is
// added between each pair for viewing.
//
function parseNMPContents(fileContents) {

    var table = '<table class="nmptable"><thead /><tbody>';
    // all lines describe waypoints
    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    waypoints = new Array();
    for (var i = 0; i < lines.length; i++) {
	if (lines[i].length > 0) {
	    var xline = lines[i].split(' ');
	    if (xline.length == 3) {
		waypoints[waypoints.length] = new Waypoint(xline[0], xline[1], xline[2], "", "");
	    }
	}
    }
    // graph edges between pairs, will be drawn as connections
    var numE = waypoints.length/2;
    graphEdges = new Array(numE);
    for (var i = 0; i < numE; i++) {
	// add the edge
	graphEdges[i] = new GraphEdge(2*i, 2*i+1, "", null);

	// add an entry to the table to be drawn in the pointbox
	var miles = Mileage(waypoints[2*i].lat, waypoints[2*i].lon, waypoints[2*i+1].lat, waypoints[2*i+1].lon).toFixed(4);
	var feet = Feet(waypoints[2*i].lat, waypoints[2*i].lon, waypoints[2*i+1].lat, waypoints[2*i+1].lon).toFixed(2);
	table += "<tr><td><table class=\"nmptable2\"><thead /><tbody><tr><td>"
	    + "<a onclick=\"javascript:LabelClick(" + 2*i + ",\'"
	    + waypoints[2*i].label + "\',"
	    + waypoints[2*i].lat + "," + waypoints[2*i].lon + ",0);\">"
	    + waypoints[2*i].label + "</a></td><td>("
	    + waypoints[2*i].lat + ","
	    + waypoints[2*i].lon + ")</td></tr><tr><td>"
	    + "<a onclick=\"javascript:LabelClick(" + 2*i+1 + ",\'"
	    + waypoints[2*i+1].label + "\',"
	    + waypoints[2*i+1].lat + "," + waypoints[2*i+1].lon + ",0);\">"
	    + waypoints[2*i+1].label + "</a></td><td>("
	    + waypoints[2*i+1].lat + ","
	    + waypoints[2*i+1].lon + ")</td></tr>"
	    + "</tbody></table></td><td>"
	    + miles  + " mi/"
	    + feet + " ft</td></tr>";
    }

    table += "</tbody></table>";
    genEdges = false;
    return table;
}

// parse the contents of a .wpl file
//
// Consists of a series of lines, each containing a waypoint name
// followed by two floating point numbers representing the point's
// latitude and longitude
//
function parseWPLContents(fileContents) {

    var table = '<table class="nmptable"><thead /><tbody>';
    // all lines describe waypoints
    var lines = fileContents.replace(/\r\n/g,"\n").split('\n');
    waypoints = new Array();
    for (var i = 0; i < lines.length; i++) {
	if (lines[i].length > 0) {
	    var xline = lines[i].split(' ');
	    if (xline.length == 3) {
		waypoints[waypoints.length] = new Waypoint(xline[0], xline[1], xline[2], "", "");
	    }
	}
    }
    // no edges here
    graphEdges = new Array();
    genEdges = false;
    return "<h2>Raw file contents:</h2><pre>" + fileContents + "</pre>";
}

function WPTLine2Waypoint(line) {

    // remove extraneous spaces in the line
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');

    var xline = line.split(' ');
    if (xline.length < 2) {
	return Waypoint('bad-line', 0, 0);
    }
    var label = xline[0];
    var url = xline[1];
    var latlon = Url2LatLon(url);
    return new Waypoint(label, latlon[0], latlon[1], 0, "");
}

// convert an openstreetmap URL to a latitude/longitude
function Url2LatLon(url) {

    var latlon = new Array(0., 0.);
    var floatpattern = '([-+]?[0-9]*\.?[0-9]+)';
    var latpattern = 'lat=' + floatpattern;
    var lonpattern = 'lon=' + floatpattern;

    //search for lat
    var matches = url.match(latpattern);
    if (matches != null) {
	latlon[0] = parseFloat(matches[1]).toFixed(6);
    }

    //search for lon
    matches = url.match(lonpattern);
    if (matches != null) {
	latlon[1] = parseFloat(matches[1]).toFixed(6);
    }

    return latlon;
}

// "standardize" a PTH line so it has coordinates separated by a space
// instead of in parens and with any extraneous spaces removed
function standardizePTHLine(line) {

    // remove extraneous spaces
    var newline = line;
    do {
	line = newline;
	newline = line.replace('  ',' ');
    } while (line != newline);


    // if this doesn't end in a paren, we should be good
    if (!line.endsWith(')')) {
	return line;
    }

    // this ends in a paren, so we convert each "(lat,lng)" group to
    // simply "lat lng"
    var xline = line.split(' ');
    line = xline[0];
    for (var pos = 1; pos < xline.length; pos++) {
	var newlatlng = xline[pos];
	if ((xline[pos].charAt(0) == '(') &&
	    (xline[pos].indexOf(',') > 0) &&
	    (xline[pos].charAt(xline[pos].length-1) == ')')) {
	    newlatlng = xline[pos].replace('(', '');
	    newlatlng = newlatlng.replace(',', ' ');
	    newlatlng = newlatlng.replace(')', '');
	}
	line += " " + newlatlng;
    }
    return line;
}

// convert a "standardized" PTH line to a Waypoint object with support
// for intermediate points along a segment
function PTHLine2Waypoint(line) {

    var xline = line.split(' ');
    if (xline.length < 4) {
	return Waypoint('bad-line', 0, 0);
    }
    return new Waypoint(xline[xline.length-3], xline[xline.length-2], xline[xline.length-1], 0, xline[0]);

}

// OLD: convert PTH line to a Waypoint object
function PTHLine2WaypointOLD(line) {

    // remove any extraneous spaces in the line
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');
    line = line.replace('  ', ' ');

    var xline = line.split(' ');
    // check for and convert a (lat,lng) format
    if ((xline.length == 3) &&
	(xline[2].charAt(0) == '(') &&
	(xline[2].indexOf(',') > 0) &&
	(xline[2].charAt(xline[2].length-1) == ')')) {
	newlatlng = xline[2].replace('(', '');
	newlatlng = newlatlng.replace(',', ' ');
	newlatlng = newlatlng.replace(')', '');
	return PTHLine2Waypoint(xline[0] + " " + xline[1] + " " + newlatlng);
    }
    if (xline.length < 4) {
	return Waypoint('bad-line', 0, 0);
    }
    return new Waypoint(xline[1], xline[2], xline[3], 0, xline[0]);
}

// mileage with a "standardized" PTH line that could have intermediate points
// to include
function mileageWithPTHLine(from, to, line) {

    var xline = line.split(' ');
    if (xline.length == 4) {
	// no intermediate points, so just compute mileage
	return Mileage(from.lat, from.lon, to.lat, to.lon);
    }

    // we have more points, compute sum of segments
    var total = 0.0;
    var last_lat = from.lat;
    var last_lon = from.lon;
    var num_points = (xline.length - 4) / 2;
    for (var i = 0; i < num_points; i++) {
	var this_lat = parseFloat(xline[2*i+1]).toFixed(6);
	var this_lon = parseFloat(xline[2*i+2]).toFixed(6);
	total += Mileage(last_lat, last_lon, this_lat, this_lon);
	last_lat = this_lat;
	last_lon = this_lon;
    }
    total += Mileage(last_lat, last_lon, to.lat, to.lon);
    return total;
}

// parse all useful info from a "standardized" PTH file line and
// return in an object with fields for waypoint (a Waypoint object),
// mileage (a number), and via, an array of lat/lng values the
// path passes through that will be used to construct the edge
// that this line represents in the path
// extra parameter is the previous waypoint for mileage computation
function PTHLineInfo(line, from) {

    var xline = line.split(' ');
    if (xline.length < 4) {
	return {
	    waypoint: Waypoint('bad-line', 0, 0),
	    mileage: 0.0,
	    via: null};
    }
    var result = {
	waypoint: new Waypoint(xline[xline.length-3], xline[xline.length-2], xline[xline.length-1], xline[0], new Array()),
	mileage: 0.0,
	via: null
    };

    if (xline.length == 4) {
	// no intermediate points, so just compute mileage and have a
	// null "via" list
	if (from != null) {
	    result.mileage = Mileage(from.lat, from.lon,
				     result.waypoint.lat, result.waypoint.lon);
	}
	result.via = null;
    }
    else {
	// we have more points, compute sum of segments
	// and remember our list of lat/lng points in via
	var total = 0.0;
	var last_lat = from.lat;
	var last_lon = from.lon;
	var num_points = (xline.length - 4) / 2;
	for (var i = 0; i < num_points; i++) {
	    var this_lat = parseFloat(xline[2*i+1]).toFixed(6);
	    var this_lon = parseFloat(xline[2*i+2]).toFixed(6);
	    total += Mileage(last_lat, last_lon, this_lat, this_lon);
	    last_lat = this_lat;
	    last_lon = this_lon;
	}
	total += Mileage(last_lat, last_lon,
			 result.waypoint.lat, result.waypoint.lon);
	result.mileage = total;
	result.via = xline.slice(1,xline.length-3);
    }
    return result;
}



// GraphEdge constructor, vertex numbers can come in as strings or
// numbers, will store as numbers
function GraphEdge(v1, v2, label, via) {

    if (typeof v1 === 'string') {
	this.v1 = parseInt(v1);
	this.v2 = parseInt(v2);
    }
    else {
	this.v1 = v1;
	this.v2 = v2;
    }
    this.label = label;
    this.via = via;
    return this;
}
