// Config
const width = 800;
const height = 600;
let currentView = 'india';

// Data placeholders (Can be expanded)
const nationalData = {
    "Odisha": { pop: "47.0M", tfr: "1.8", color: "#fdbb2d" },
    "Maharashtra": { pop: "126M", tfr: "1.7", color: "#2c3e50" },
    "Uttar Pradesh": { pop: "235M", tfr: "2.4", color: "#2c3e50" }
};

// District data logic (Extracted from previous code)
const getMortality = (d) => {
    return d.properties.Dist_Code === "384" ? "50 lakh" : "32.4 per 1000";
};

const getFertility = (d) => {
    return d.properties.Dist_Code === "384" ? "3 lakh" : "1.8 (Avg)";
};

// Tooltip
const tip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);

// SVG Setup
const svg = d3.select("#map-container").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

const g = svg.append("g");

// Initialization
loadMap('./india.geojson', 'india');

function loadMap(url, type) {
    currentView = type;
    
    // UI Updates
    d3.select("#back-btn").style("display", type === 'india' ? 'none' : 'block');
    d3.select("#page-title").text(type === 'india' ? 'India Demographic Profile' : 'Odisha: District Level Insight');
    d3.select("#drill-down-hint").style("display", type === 'india' ? 'block' : 'none');
    d3.select("#district-info").style("display", type === 'india' ? 'none' : 'block');
    
    // Reset Sidebar
    updateSidebar(type === 'india' ? 'India' : 'Odisha', 
                  type === 'india' ? '1.42B' : '47.0M', 
                  type === 'india' ? '1.98' : '1.8');

    g.selectAll("path").transition().duration(300).style("opacity", 0).remove();

    d3.json(url).then(data => {
        const projection = d3.geoMercator().fitSize([width, height], data);
        const path = d3.geoPath().projection(projection);

        const mapPaths = g.selectAll("path")
            .data(data.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", d => {
                if (type === 'india') {
                    return d.properties.ST_NM === "Odisha" ? "#fdbb2d" : "#1c2230";
                } else {
                    return d3.interpolateSpectral(Math.random()); // Random colors for districts for now
                }
            })
            .style("opacity", 0);

        mapPaths.transition().duration(800).style("opacity", 1);

        mapPaths.on("mouseover", function(event, d) {
            const name = type === 'india' ? d.properties.ST_NM : d.properties.Dist_Name;
            
            d3.select(this).style("stroke", "white").style("stroke-width", "2px");
            
            tip.transition().duration(200).style("opacity", 1);
            tip.html(`<strong style="color:var(--teal)">${name}</strong>`)
               .style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");

            if (type === 'india') {
                const s = nationalData[name];
                if (s) updateSidebar(name, s.pop, s.tfr);
            } else {
                updateSidebar(name, getMortality(d), getFertility(d), "Mortality Rate", "Fertility Rate");
            }
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "rgba(255,255,255,0.1)").style("stroke-width", "0.5px");
            tip.transition().duration(500).style("opacity", 0);
        })
        .on("click", function(event, d) {
            if (type === 'india' && d.properties.ST_NM === "Odisha") {
                loadMap('./Orissa.geojson', 'odisha');
            }
        });
    });
}

function updateSidebar(name, val1, val2, label1 = "Total Population", label2 = "Fertility Rate") {
    d3.select("#region-name").text(name);
    d3.select("#stat-1-label").text(label1);
    d3.select("#stat-1-value").text(val1);
    d3.select("#stat-2-label").text(label2);
    d3.select("#stat-2-value").text(val2);
    
    // Change color of fertility/mortality based on value
    d3.select("#stat-2-value").attr("class", `stat-value ${parseFloat(val2) > 2 ? 'red' : 'green'}`);
}

// Back Button
d3.select("#back-btn").on("click", () => {
    loadMap('./india.geojson', 'india');
});
