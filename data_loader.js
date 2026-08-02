/**
 * data_loader.js
 * Centralized, cached data provider for the Odisha Demographics Storytelling Portal.
 * Prevents redundant fetches and provides convenient helper methods.
 */

const DataLoader = {
  _cache: {},

  loadJSON: function(url) {
    if (this._cache[url]) {
      return Promise.resolve(this._cache[url]);
    }
    return d3.json(url).then(data => {
      this._cache[url] = data;
      return data;
    });
  },

  // Helper getters for each dataset
  getDistrictPopulationTrends: function() {
    return this.loadJSON("datasets/district_population_trends.json");
  },

  getDistrictFertilityTrends: function() {
    return this.loadJSON("datasets/district_fertility_trends.json");
  },

  getDistrictLifeExpectancy: function() {
    return this.loadJSON("datasets/district_life_expectancy.json");
  },

  getDistrictMortality: function() {
    return this.loadJSON("datasets/district_mortality.json");
  },

  getDistrictAgePyramids: function() {
    return this.loadJSON("datasets/district_age_pyramids.json");
  },

  getNationalComparisons: function() {
    return this.loadJSON("datasets/national_comparisons.json");
  },

  getStateDemographics: function() {
    return this.loadJSON("datasets/state_demographics.json");
  },

  getDistrictDetails: function() {
    return this.loadJSON("datasets/districts_detail.json");
  }
};
