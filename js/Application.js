/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * SST
 *  https://coralreefwatch.noaa.gov/product/5km/index_5km_sst.php
 *  The NOAA Coral Reef Watch (CRW) daily global 5km Sea Surface Temperature (SST) product, also known as CoralTemp, shows the nighttime ocean temperature measured at the surface. The SST scale ranges from -2 to 35 °C.
 *  The CoralTemp SST data product was developed from two, related reanalysis (reprocessed) SST products and a near real-time SST product. Spanning January 1, 1985 to the present, the CoralTemp SST is one of the best and most internally consistent daily global 5km SST products available.
 *
 * SSTA
 *  https://coralreefwatch.noaa.gov/product/5km/index_5km_ssta.php
 *  The NOAA Coral Reef Watch (CRW) daily global 5km Sea Surface Temperature (SST) Anomaly product displays the difference between today's SST and the long-term average. The scale ranges from -5 to +5 °C. Positive values mean the temperature measured is warmer than average; negative values mean cooler than average.
 *
 */

const promiseUtils = await $arcgis.import("esri/core/promiseUtils");
const reactiveUtils = await $arcgis.import("esri/core/reactiveUtils");

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './apl/SignIn.js';
import ViewLoading from './apl/ViewLoading.js';

//import GlobeSpinner from './apl/GlobeSpinner.js';

//Chart.defaults.font.family = 'Avenir Next LT Pro';
Chart.defaults.font.family = 'Poppins';
Chart.defaults.color = '#efefef';

class Application extends AppBase {

  /**
   * @type {Portal}
   */
  portal;

  /**
   *  @type {number}
   */
  MISSING_DATA_VALUE = Number.NEGATIVE_INFINITY;

  /**
   *  @type {number}
   */
  ONE_DAY_MS = (1000 * 60 * 60 * 24);

  /**
   *
   * @type {Intl.DateTimeFormat}
   */
  dateFormatter = new Intl.DateTimeFormat('default', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });

  /**
   *
   * @type {Intl.DateTimeFormat}
   */
  dayFormatter = new Intl.DateTimeFormat('default', { timeZone: 'UTC', month: 'long', day: 'numeric' });

  /**
   *
   */
  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({ app: this });
      applicationLoader.load().then(({ portal, group, map, view }) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({ map, group });

        // STARTUP DIALOG //
        this.initializeStartupDialog();

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({ view });

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({ portal, group, map, view }).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
          //console.info("Application ready...");
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {

    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({ container: signInContainer, portal: this.portal });
    }

  }

  /**
   *
   * @param view
   */
  configView({ view }) {
    return new Promise(async (resolve, reject) => {
      if (view) {

        // VIEW AND POPUP //
        const Popup = await $arcgis.import("esri/widgets/Popup");
        view.set({
          constraints: { snapToZoom: false },
          popup: new Popup({
            dockEnabled: true,
            dockOptions: {
              buttonEnabled: false,
              breakpoint: false,
              position: "top-right"
            }
          }),
          qualityProfile: "high",
          environment: {
            starsEnabled: false,
            atmosphereEnabled: false,
            lighting: { type: "virtual" }
          }
        });

        // HOME //
        const Home = await $arcgis.import("esri/widgets/Home");
        const home = new Home({ view });
        view.ui.add(home, { position: 'top-left', index: 0 });

        // SEARCH //
        // const Search = await $arcgis.import("esri/widgets/Search");
        // const search = new Search({view: view});
        // view.ui.add(search, {position: 'top-left', index: 0});

        // COMPASS //
        const Compass = await $arcgis.import("esri/widgets/Compass");
        const compass = new Compass({ view: view });
        view.ui.add(compass, { position: 'top-left', index: 2 });
        reactiveUtils.watch(() => view.rotation, rotation => {
          compass.set({ visible: (rotation > 0) });
        }, { initial: true });

        // MAP SCALE //
        // const mapScale = new MapScale({view});
        // view.ui.add(mapScale, {position: 'bottom-left', index: 0});

        // VIEW LOADING INDICATOR //
        this.viewLoading = new ViewLoading({ view: view });
        view.ui.add(this.viewLoading, 'bottom-right');

        // GLOBE SPINNER //
        // this.globeSpinner = new GlobeSpinner({view, scale: GlobeSpinner.SCALE_OPTION.SMALL});
        // this.globeSpinner.addEventListener('state-change', ({detail: {direction}}) => {
        //   this.viewLoading.enabled = (direction === GlobeSpinner.DIRECTION.NONE);
        // });
        // reactiveUtils.once(() => !view.updating).then(() => {
        //   this.globeSpinner.setSpinState(GlobeSpinner.DIRECTION.RIGHT);
        // });
        // view.ui.add(this.globeSpinner, 'top-right');

        // LAYER LIST //
        const LayerList = await $arcgis.import("esri/widgets/LayerList");
        const layerList = new LayerList({
          container: 'layers-container',
          view: view,
          visibleElements: {
            errors: true,
            statusIndicators: true
          }
        });

        resolve();

      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({ portal, group, map, view }) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({ view }).then(async () => {

        // SETTINGS //
        this.settings = {
          yearsExtent: null,
          currentDate: null,
          currentYear: null,
          currentYearRange: null
        };

        await this.initializeSSTLayer({ view });
        await this.initializeDailyTempChart({ view });
        await this.initializeYearlyTempChart({ view });
        await this.initializeLocationInfo({ view });
        await this.initializeTemperatureProfile({ view });

        // HIDE HOW TO TOOLTIP //
        await this.hideHowToTooltip();

        resolve();
      }).catch(reject);
    });
  }

  /**
   *
   * @param error
   * @return {false|void}
   */
  handleAbort = error => !promiseUtils.isAbortError(error) && this.displayError(error);

  /**
   *
   * @return {Promise<>}
   */
  async hideHowToTooltip() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const appHowtoTooltip = document.getElementById('app-howto-tooltip');
        appHowtoTooltip.toggleAttribute('open', false);
        resolve();
      }, 1000);
    });
  }

  /**
   *
   * @param view
   */
  async initializeSSTLayer({ view }) {

    const sstGroupLayer = view.map.layers.find(layer => layer.title === 'SST');
    await sstGroupLayer.loadAll();

    const sstLayer = sstGroupLayer.layers.find(layer => layer.title === 'Sea Surface Temperature');
    const sstaLayer = sstGroupLayer.layers.find(layer => layer.title === 'Sea Surface Temperature Anomaly');

    // LEGEND //
    const Legend = await $arcgis.import("esri/widgets/Legend");
    const legend = new Legend({
      view: view,
      layerInfos: [
        { title: 'Temperature °C', layer: sstLayer },
        { title: 'Anomaly °C', layer: sstaLayer }
      ]
    });
    view.ui.add(legend, { position: 'top-right', index: 0 });

    // CURRENT MULTIDIMENSIONAL DEFINITION //
    const currentSSTMultidimensionalDef = sstLayer.mosaicRule.multidimensionalDefinition.at(0).clone();
    const currentSSTAMultidimensionalDef = sstaLayer.mosaicRule.multidimensionalDefinition.at(0).clone();

    // MULTIDIMENSIONAL INFO //
    const { multidimensionalInfo: sstMultidimensionalInfo, rasterInfo } = sstLayer;

    // MULTIDIMENSIONAL INFO //
    const { multidimensionalInfo: sstaMultidimensionalInfo } = sstaLayer;

    // SST VARIABLE //
    const sstVariableName = 'sst';
    const sstVariable = sstMultidimensionalInfo.variables.find(variable => variable.name === sstVariableName);

    // SSTA VARIABLE //
    const sstaVariableName = 'ssta';
    const sstaVariable = sstaMultidimensionalInfo.variables.find(variable => variable.name === sstaVariableName);

    // VALUE TO COLOR //
    await this.initializeValueToColor({ sstLayer, sstaLayer });

    const variableOption = document.getElementById('variable-option');
    variableOption.addEventListener('calciteSegmentedControlChange', () => {
      switch (variableOption.value) {
        case "sst":
          sstLayer.visible = true;
          break;
        case "ssta":
          sstaLayer.visible = true;
          break;
      }

      this.updateCurrent().catch(this.handleAbort);

      this.dispatchEvent(new CustomEvent('visible-layer-change', { detail: this.getVisibleLayerInfos() }));
    });

    /**
     *
     * @return {{sstVisible: boolean, sstaVisible: boolean, visibleLayer: TileImageryLayer}}
     */
    this.getVisibleLayerInfos = () => {
      return {
        sstVisible: sstLayer.visible,
        sstaVisible: sstaLayer.visible,
        visibleLayer: sstLayer.visible ? sstLayer : sstaLayer
      };

    };

    // TIME DIMENSION //
    //  - ASSUMING SSTA LAYER HAS SAME TIME DIMENSIONS //
    const timeDimensionName = currentSSTMultidimensionalDef.dimensionName;
    const timeDimension = sstVariable.dimensions.find(dimension => dimension.name === timeDimensionName);

    // ISSUE: SSTA LAYER MOSAIC RULE MISSING DIMENSION NAME... ///
    currentSSTAMultidimensionalDef.dimensionName = timeDimensionName;

    // FULL TIME EXTENT //
    const fullTimeExtent = {
      start: new Date(timeDimension.extent.at(0)),
      end: new Date(timeDimension.extent.at(1))
    };

    // INITIAL DATE AND YEAR //
    this.settings.yearsExtent = {
      startYear: fullTimeExtent.start.getUTCFullYear(),
      endYear: fullTimeExtent.end.getUTCFullYear()
    };
    this.settings.currentDate = fullTimeExtent.end;
    this.settings.currentYear = this.settings.currentDate.getUTCFullYear();

    const prevYearBtn = document.getElementById('prev-year-btn');
    prevYearBtn.addEventListener('click', () => {
      if (!view.updating) {
        this.dispatchEvent(new CustomEvent('year-change', ({ detail: { year: this.settings.currentYear - 1 } })));
      }
    });

    const nextYearBtn = document.getElementById('next-year-btn');
    nextYearBtn.addEventListener('click', () => {
      if (!view.updating) {
        this.dispatchEvent(new CustomEvent('year-change', ({ detail: { year: this.settings.currentYear + 1 } })));
      }
    });

    const NO_YEAR = '----';

    // CURRENT YEAR DATES RANGE //
    const _updateCurrentYearRange = () => {

      this.settings.currentYearRange = [
        Date.UTC(this.settings.currentYear, 0, 1, 12, 0, 0, 0),
        Date.UTC(this.settings.currentYear, 11, 31, 12, 0, 0, 0)
      ];

      const { startYear, endYear } = this.settings.yearsExtent;
      prevYearBtn.innerText = (this.settings.currentYear > startYear) ? (this.settings.currentYear - 1) : NO_YEAR;
      nextYearBtn.innerText = (this.settings.currentYear < endYear) ? (this.settings.currentYear + 1) : NO_YEAR;
      prevYearBtn.toggleAttribute('disabled', prevYearBtn.innerText === NO_YEAR);
      nextYearBtn.toggleAttribute('disabled', nextYearBtn.innerText === NO_YEAR);

    };
    _updateCurrentYearRange();
    //console.table(this.settings)

    // CURRENT DATE LABEL //
    const temperatureBlock = document.getElementById('temperature-block');
    const _updateCurrentDateLabel = () => {
      temperatureBlock.setAttribute('heading', `${sstLayer.visible ? 'Temperatures' : 'Anomalies'} on ${this.dateFormatter.format(this.settings.currentDate)}`);
    };
    _updateCurrentDateLabel();

    /**
     * ANIMATE DATE OVER TIME
     */
    await this.initializeDataAnimation({ view, sstLayer, fullTimeExtent });

    /**
     *
     */
    this.updateSSTLayers = () => {

      const currentTimestamp = this.settings.currentDate.valueOf();

      const isValidDate = timeDimension.values.includes(currentTimestamp);
      if (isValidDate) {

        currentSSTMultidimensionalDef.values = [currentTimestamp];
        const _sstMosaicRule = sstLayer.mosaicRule.clone();
        _sstMosaicRule.multidimensionalDefinition = [currentSSTMultidimensionalDef];
        sstLayer.mosaicRule = _sstMosaicRule;

        currentSSTAMultidimensionalDef.values = [currentTimestamp];
        const _sstaMosaicRule = sstaLayer.mosaicRule.clone();
        _sstaMosaicRule.multidimensionalDefinition = [currentSSTAMultidimensionalDef];
        sstaLayer.mosaicRule = _sstaMosaicRule;

      }
    };

    /**
     *
     */
    this.updateSSTLayers();

    /**
     *
     * @private
     */
    this.updateCurrent = promiseUtils.debounce(async () => {
      _updateCurrentYearRange();
      _updateCurrentDateLabel();
      this.updateSSTLayers();
      await reactiveUtils.once(() => !view.updating);
      await this.updateDataAtLocation();
      this.updateTemperatureProfile({});
    });

    /**
     * DAY CHANGE
     */
    this.addEventListener('day-change', ({ detail: { day } }) => {
      //console.info(`Day Change: ${ day.toISOString() }`);
      this.settings.currentDate = day;
      this.settings.currentYear = this.settings.currentDate.getUTCFullYear();
      this.updateCurrent().catch(this.handleAbort);
    });

    /**
     * YEAR CHANGE
     */
    this.addEventListener('year-change', ({ detail: { year } }) => {
      //console.info(`Year Change: ${ year }`);
      this.settings.currentYear = Number(year);
      this.settings.currentDate.setUTCFullYear(this.settings.currentYear);
      this.updateCurrent().catch(this.handleAbort);
    });

    /**
     *
     * @param {Date} dt
     * @return {string}
     */
    function isoDayOfWeek(dt) {
      let wd = dt.getUTCDay(); // 0..6, from sunday
      wd = (wd + 6) % 7 + 1; // 1..7 from monday
      return '' + wd; // string so it gets parsed
    }

    /**
     *
     * @param dataAtLocation
     * @param currentYearRange
     * @return {*[]}
     */
    this.fillMissingDays = ({ dataAtLocation = [] }) => {

      const lastTimestamp = this.settings.currentYearRange.at(1);

      let day = dataAtLocation.length
        ? dataAtLocation.at(-1).date
        : new Date(Date.UTC(this.settings.currentYear - 1, 11, 31, 12, 0, 0, 0));

      do {

        day = new Date(day.valueOf() + this.ONE_DAY_MS);
        const iso = day.toISOString().substr(0, 10);
        const diff = Math.abs(this.settings.currentDate.valueOf() - day.valueOf());

        dataAtLocation.push({
          x: iso,
          y: isoDayOfWeek(day),
          date: day,
          year: String(day.getUTCFullYear()),
          fullYear: day.getUTCFullYear(),
          label: this.dateFormatter.format(day),
          diff: diff,
          temp: this.MISSING_DATA_VALUE,
          anomaly: this.MISSING_DATA_VALUE
        });

      } while (day.valueOf() < lastTimestamp);

      return dataAtLocation;
    };

    /**
     *
     * @param location
     * @param signal
     * @return {Promise<>}
     */
    this.getYearlyDataAtLocation = ({ location, signal }) => {
      return new Promise((resolve, reject) => {
        if (location) {

          const { startYear, endYear } = this.settings.yearsExtent;

          const yearlySlices = [];
          for (let year = startYear; year <= endYear; year++) {
            yearlySlices.push(Date.UTC(year, this.settings.currentDate.getUTCMonth(), this.settings.currentDate.getUTCDate(), 12, 0, 0, 0));
          }

          sstLayer.getSamples({
            geometry: location,
            returnFirstValueOnly: false,
            interpolation: 'nearest',
            pixelSize: rasterInfo.pixelSize,
            mosaicRule: {
              multidimensionalDefinition: [
                {
                  variableName: sstVariable.name,
                  dimensionName: timeDimension.name,
                  isSlice: true,
                  values: yearlySlices
                },
                {
                  variableName: sstaVariable.name,
                  dimensionName: timeDimension.name,
                  isSlice: true,
                  values: yearlySlices
                }
              ]
            }
          }, { signal: signal }).then(({ samples }) => {
            if (!signal.aborted) {

              let dataAtLocation = samples.reduce((infos, sample) => {

                const { StdTime, sst, ssta } = sample.attributes;
                const _temp = sst?.length ? Number(sst) : Number.NaN;
                const _anomaly = ssta?.length ? Number(ssta) : Number.NaN;

                const day = new Date(StdTime);
                const iso = day.toISOString().substr(0, 10);
                const diff = Math.abs(this.settings.currentDate.valueOf() - day.valueOf());

                return infos.concat({
                  x: iso,
                  y: isoDayOfWeek(day),
                  date: day,
                  year: String(day.getUTCFullYear()),
                  fullYear: day.getUTCFullYear(),
                  label: this.dateFormatter.format(day),
                  diff: diff,
                  temp: _temp,
                  anomaly: _anomaly
                });
              }, []);

              resolve({ dataAtLocation });
            } else {
              resolve({ dataAtLocation: null });
            }
          });
        } else {
          resolve({ dataAtLocation: null });
        }
      });
    };

    /**
     *
     * @param location
     * @param signal
     * @return {Promise<>}
     */
    this.getDailyDataAtLocation = ({ location, signal }) => {
      return new Promise((resolve, reject) => {
        if (location) {

          const timeExtent = {
            start: new Date(this.settings.currentYearRange.at(0)),
            end: new Date(this.settings.currentYearRange.at(1))
          };

          sstLayer.getSamples({
            geometry: location,
            returnFirstValueOnly: false,
            interpolation: 'nearest',
            pixelSize: rasterInfo.pixelSize,
            outFields: [sstVariable.name, sstaVariable.name],
            timeExtent
            /*mosaicRule: {
             multidimensionalDefinition: [
             {
             variableName: sstVariable.name,
             dimensionName: timeDimension.name,
             isSlice: false,
             values: [this.settings.currentYearRange]
             },
             {
             variableName: sstaVariable.name,
             dimensionName: timeDimension.name,
             isSlice: false,
             values: [this.settings.currentYearRange]
             }
             ]
             }*/
          }, { signal: signal }).then(({ samples }) => {
            if (!signal.aborted) {

              let dataAtLocation = samples.reduce((infos, sample) => {

                const { StdTime, sst, ssta } = sample.attributes;
                const _temp = sst?.length ? Number(sst) : Number.NaN;
                const _anomaly = ssta?.length ? Number(ssta) : Number.NaN;

                const day = new Date(StdTime);
                const iso = day.toISOString().substr(0, 10);
                const diff = Math.abs(this.settings.currentDate.valueOf() - day.valueOf());

                return infos.concat({
                  x: iso,
                  y: isoDayOfWeek(day),
                  date: day,
                  year: String(day.getUTCFullYear()),
                  fullYear: day.getUTCFullYear(),
                  label: this.dateFormatter.format(day),
                  diff: diff,
                  temp: _temp,
                  anomaly: _anomaly
                });
              }, []);

              if (dataAtLocation.at(-1).date.valueOf() < this.settings.currentYearRange.at(1)) {
                this.fillMissingDays({ dataAtLocation });
              }

              resolve({ dataAtLocation });
            } else {
              resolve({ dataAtLocation: null });
            }
          });
        } else {
          resolve({ dataAtLocation: null });
        }
      });
    };

    const Point = await $arcgis.import("esri/geometry/Point");
    //const Polyline = await $arcgis.import("esri/geometry/Polyline");
    //const geometryEngine = await $arcgis.import("esri/geometry/geometryEngine");
    const geodesicUtils = await $arcgis.import("esri/geometry/support/geodesicUtils");
    const webMercatorUtils = await $arcgis.import("esri/geometry/support/webMercatorUtils");

    const _getGeodesicDistance = ({ startLon, startLat, endLon, endLat }) => {
      const { distance } = geodesicUtils.geodesicDistance(new Point(startLon, startLat), new Point(endLon, endLat), 'kilometers');
      return distance;
    };

    /**
     *
     * @param profileLine
     * @return {Promise<{dataAtLocation:number[]}>}
     */
    this.getDataProfile = ({ profileLine }) => {
      return new Promise((resolve, reject) => {

        const profileLineGeo = webMercatorUtils.webMercatorToGeographic(profileLine, true);
        const currentTimestamp = this.settings.currentDate.valueOf();

        sstLayer.getSamples({
          geometry: profileLineGeo,
          sampleCount: 50,
          returnFirstValueOnly: false,
          interpolation: 'nearest',
          pixelSize: rasterInfo.pixelSize,
          outFields: [sstVariable.name, sstaVariable.name],
          mosaicRule: {
            multidimensionalDefinition: [
              {
                variableName: sstVariable.name,
                dimensionName: timeDimension.name,
                isSlice: true,
                values: [currentTimestamp]
              },
              {
                variableName: sstaVariable.name,
                dimensionName: timeDimension.name,
                isSlice: true,
                values: [currentTimestamp]
              }
            ]
          }
        }).then(({ samples }) => {
          //console.info(samples);

          const { longitude: startLon, latitude: startLat } = profileLine.getPoint(0, 0);

          let dataAtLocation = samples.reduce((infos, sample, sampleIdx) => {

            const { longitude, latitude } = sample.location;
            const distanceMeters = _getGeodesicDistance({ startLon, startLat, endLon: longitude, endLat: latitude });

            const { StdTime, sst, ssta } = sample.attributes;
            const _temp = sst?.length ? Number(sst) : Number.NaN;
            const _anomaly = ssta?.length ? Number(ssta) : Number.NaN;

            const day = new Date(StdTime);
            const iso = day.toISOString().substr(0, 10);
            const diff = Math.abs(this.settings.currentDate.valueOf() - day.valueOf());

            return infos.concat({
              x: iso,
              y: isoDayOfWeek(day),
              idx: sampleIdx,
              date: day,
              year: String(day.getUTCFullYear()),
              fullYear: day.getUTCFullYear(),
              label: this.dateFormatter.format(day),
              diff: diff,
              temp: _temp,
              anomaly: _anomaly,
              lon: longitude,
              lat: latitude,
              distance: distanceMeters
            });
          }, []);

          dataAtLocation.sort((infoA, infoB) => { return infoA.distance - infoB.distance; });

          resolve({ dataAtLocation });

        }).catch(reject);
      });
    };
  }

  /**
   * GET COLOR FOR VALUE
   *
   * @param sstLayer
   * @param sstaLayer
   */
  async initializeValueToColor({ sstLayer, sstaLayer }) {

    // COLOR //
    const Color = await $arcgis.import('esri/Color');

    /**
     *
     * @param colorRamp
     * @return {Color[]}
     */
    const colorRampToColorList = (colorRamp) => {
      const colorsSet = colorRamp.colorRamps.reduce((colors, colorRamp) => {
        colors.add(colorRamp.fromColor.toCss(true));
        colors.add(colorRamp.toColor.toCss(true));
        return colors;
      }, new Set());
      return Array.from(colorsSet.values().map(c => new Color(c)));
    };

    // LAYER COLOR RAMPS AND STATISTICS //
    const { colorRamp: sstColorRamp, customStatistics: sstStatistics } = sstLayer.renderer;
    const { colorRamp: sstaColorRamp, customStatistics: sstaStatistics } = sstaLayer.renderer;

    // UNIQUE COLORS LIST //
    const sstColors = colorRampToColorList(sstColorRamp);
    const sstaColors = colorRampToColorList(sstaColorRamp);

    /**
     * GET COLOR USED IN RENDERER FOR A VALUE
     *
     * @param {number} midValue
     * @return {Color}
     */
    this.getColorFromValue = (midValue) => {

      const [min, max] = sstLayer.visible ? sstStatistics.at(0) : sstaStatistics.at(0);
      midValue = Math.min(Math.max(midValue, min), max);

      const colors = sstLayer.visible ? sstColors : sstaColors;
      const colorAlong = colors.length * ((midValue - min) / (max - min));
      const colorIdx = Math.min(Math.max(Math.floor(colorAlong), 0), colors.length - 2);

      return Color.blendColors(colors.at(colorIdx), colors.at(colorIdx + 1), (colorAlong - colorIdx));
    };

  }

  /**
   *
   * @param {SceneView} view
   * @param {ImageryLayer} sstLayer
   * @param {{start:Date,end:Date}} fullTimeExtent
   * @return {Promise<void>}
   */
  async initializeDataAnimation({ view, sstLayer, fullTimeExtent }) {

    // SST ImageryLayerView //
    const sstLayerView = await view.whenLayerView(sstLayer);

    // TIME EXTENT TIMESTAMPS //
    const firstTimestamp = fullTimeExtent.start.valueOf();
    const lastTimestamp = fullTimeExtent.end.valueOf();

    //
    // ANIMATE //
    //
    let _playing = false;

    const firstBtn = document.getElementById('first-btn');
    const prevBtn = document.getElementById('prev-btn');
    const playBtn = document.getElementById('play-btn');
    const nextBtn = document.getElementById('next-btn');
    const lastBtn = document.getElementById('last-btn');

    firstBtn.setAttribute('title', `first day ( ${this.dateFormatter.format(fullTimeExtent.start)} )`);
    lastBtn.setAttribute('title', `most recent day ( ${this.dateFormatter.format(fullTimeExtent.end)} )`);

    reactiveUtils.watch(() => view.updating, updating => {
      firstBtn.toggleAttribute('disabled', updating || _playing);
      prevBtn.toggleAttribute('disabled', updating || _playing);
      nextBtn.toggleAttribute('disabled', updating || _playing);
      lastBtn.toggleAttribute('disabled', updating || _playing);
    }, { initial: true });

    const _goFirst = () => {
      const firstDay = new Date(firstTimestamp);
      this.dispatchEvent(new CustomEvent('day-change', ({ detail: { day: firstDay } })));
    };

    const _goPrev = () => {
      const prevDay = (this.settings.currentDate.valueOf() > firstTimestamp)
        ? new Date(this.settings.currentDate.valueOf() - this.ONE_DAY_MS)
        : new Date(lastTimestamp);
      this.dispatchEvent(new CustomEvent('day-change', ({ detail: { day: prevDay } })));
    };

    const _goNext = () => {
      const nextDay = (this.settings.currentDate.valueOf() < lastTimestamp)
        ? new Date(this.settings.currentDate.valueOf() + this.ONE_DAY_MS)
        : new Date(firstTimestamp);
      this.dispatchEvent(new CustomEvent('day-change', ({ detail: { day: nextDay } })));
    };

    const _goLast = () => {
      const lastDay = new Date(lastTimestamp);
      this.dispatchEvent(new CustomEvent('day-change', ({ detail: { day: lastDay } })));
    };

    firstBtn.addEventListener('click', () => { _goFirst(); });
    prevBtn.addEventListener('click', () => { _goPrev(); });
    nextBtn.addEventListener('click', () => { _goNext(); });
    lastBtn.addEventListener('click', () => { _goLast(); });

    const _animateNext = () => {
      _goNext();
      reactiveUtils.whenOnce(() => !sstLayerView.updating).then(() => {
        setTimeout(() => {
          _playing && requestAnimationFrame(_animateNext);
        }, 800);
      }, { initial: false });
    };

    playBtn.addEventListener('click', () => {
      _playing = playBtn.toggleAttribute('active');

      playBtn.setAttribute('icon-start', _playing ? 'pause-f' : 'play-f');
      playBtn.setAttribute('kind', _playing ? 'inverse' : 'neutral');

      this.viewLoading.enabled = !_playing;
      _playing && requestAnimationFrame(_animateNext);
    });
    playBtn.toggleAttribute('disabled', false);

  }

  /**
   *
   * @param view
   * @return {Promise<void>}
   */
  async initializeLocationInfo({ view }) {

    let _mapLocation = null;
    let _analysisLocation = null;

    const Graphic = await $arcgis.import('esri/Graphic');
    const GraphicsLayer = await $arcgis.import('esri/layers/GraphicsLayer');
    const Point = await $arcgis.import('esri/geometry/Point');

    const createTextSymbolLayer = text => {
      return {
        type: "text",
        text: text,
        material: { color: "#efefef" },
        halo: { color: "#C77A41", size: 1.5 },
        font: {
          //family: "Avenir Next LT Pro"
          family: "Poppins"
        },
        size: 21
      };
    };

    const locationSymbol = {
      type: "point-3d",
      symbolLayers: [
        createTextSymbolLayer('Analysis Location')
      ],
      verticalOffset: { screenLength: 60 },
      callout: {
        type: "line",
        size: 1.5,
        color: "#efefef",
        border: { color: "#C77A41" }
      }
    };

    const locationGraphic = new Graphic({ symbol: locationSymbol });
    const locationLayer = new GraphicsLayer({ title: 'Analysis Location', graphics: [locationGraphic] });
    view.map.add(locationLayer);

    /**
     *
     * @param location
     * @param valueLabel
     * @private
     */
    const temperatureLabel = document.getElementById('temperature-label');
    const temperatureBlock = document.getElementById('temperature-block');

    /**
     *
     * @param {Point} [location]
     * @param {string} [temp]
     * @param {number} [anomaly]
     * @private
     */
    const _updateAnalysisLocation = ({ location, temp, anomaly }) => {

      const { sstVisible } = this.getVisibleLayerInfos();

      const value = sstVisible ? temp : anomaly;
      const valueLabel = value ? `${value.toFixed(1)}° C` : 'No Data';

      const sym = locationGraphic.symbol.clone();
      sym.symbolLayers = [createTextSymbolLayer(valueLabel)];
      locationGraphic.set({ geometry: location, symbol: sym });

      temperatureLabel.innerText = valueLabel;

      if (location) {
        const coords = `longitude: ${location.longitude.toFixed(2)} latitude: ${location.latitude.toFixed(2)}`;
        temperatureBlock.setAttribute('description', coords);
      }
    };

    let yearlyAbortController;
    let dailyAbortController;

    const _updateYearlyData = () => {
      return new Promise((resolve, reject) => {

        yearlyAbortController?.abort();
        yearlyAbortController = new AbortController();
        const { signal: yearlySignal } = yearlyAbortController;
        this.getYearlyDataAtLocation({ location: _analysisLocation, signal: yearlySignal }).then(({ dataAtLocation: yearlyDataAtLocation }) => {
          if (!yearlySignal.aborted) {
            this.updateYearlyTempChart({ dataAtLocation: yearlyDataAtLocation });
            resolve();
          }
        }).catch(reject);

      });
    };

    const _updateDailyData = () => {
      return new Promise((resolve, reject) => {

        dailyAbortController?.abort();
        dailyAbortController = new AbortController();
        const { signal: dailySignal } = dailyAbortController;
        this.getDailyDataAtLocation({ location: _analysisLocation, signal: dailySignal }).then(({ dataAtLocation: dailyDataAtLocation }) => {
          if (!dailySignal.aborted) {

            const { temp, anomaly } = dailyDataAtLocation.find(data => data.diff === 0);
            _updateAnalysisLocation({ location: _mapLocation, temp, anomaly });

            this.updateDailyTempChart({ dataAtLocation: dailyDataAtLocation });

            resolve();
          }
        }).catch(reject);

      });
    };

    this.updateDataAtLocation = async () => {
      if (_analysisLocation) {

        // YEARLY //
        await _updateYearlyData();
        // DAILY //
        await _updateDailyData();

        // YEARLY //
        /*
         yearlyAbortController?.abort();
         yearlyAbortController = new AbortController();
         const {signal: yearlySignal} = yearlyAbortController;
         this.getYearlyDataAtLocation({location: _analysisLocation, signal: yearlySignal}).then(({dataAtLocation: yearlyDataAtLocation}) => {
         if (!yearlySignal.aborted) {
         this.updateYearlyTempChart({dataAtLocation: yearlyDataAtLocation});
         }
         }).catch(e => this.displayError(e));
         */

        // DAILY //
        /*
         dailyAbortController?.abort();
         dailyAbortController = new AbortController();
         const {signal: dailySignal} = dailyAbortController;
         this.getDailyDataAtLocation({location: _analysisLocation, signal: dailySignal}).then(({dataAtLocation: dailyDataAtLocation}) => {
         if (!dailySignal.aborted) {

         const {temp, anomaly} = dailyDataAtLocation.find(data => data.diff === 0);
         _updateAnalysisLocation({location: _mapLocation, temp, anomaly});

         this.updateDailyTempChart({dataAtLocation: dailyDataAtLocation});
         }
         }).catch(e => this.displayError(e));
         */

      } else {
        _updateAnalysisLocation({});
        this.updateYearlyTempChart({});
        this.updateDailyTempChart({});
      }
    };

    const _setAnalysisLocation = location => {
      _mapLocation = location;
      _analysisLocation = new Point([_mapLocation.longitude, _mapLocation.latitude]);
      this.updateDataAtLocation().catch(this.handleAbort);
    };

    let _sketchActive = false;
    this.addEventListener('profile-sketch-active', ({ detail: { sketchActive } }) => {
      _sketchActive = sketchActive;
    });

    view.container.style.cursor = 'pointer';
    reactiveUtils.on(() => view, 'click', (evt) => {
      if (!_sketchActive) {
        evt.stopPropagation();
        _setAnalysisLocation(view.toMap(evt));
      }
    });

    // INITIAL ANALYSIS //
    // const initialLocation = view.extent.center.clone();
    const initialCoords = [-102.91, 16.53]; //  [-102.91,16.53] [-93.67, -0.54] [-98.18, 2.34]
    const initialLocation = new Point(initialCoords);
    reactiveUtils.once(() => !view.updating).then(() => {
      _setAnalysisLocation(initialLocation);
    });

  }

  /**
   *
   * https://chartjs-chart-matrix.pages.dev/usage.html
   * https://chartjs-chart-matrix.pages.dev/samples/time.html
   *
   * @param view
   */
  async initializeDailyTempChart({ view }) {

    const NO_DATA_COLOR = 'rgba(127,127,127,0.4)';
    const CURRENT_DAY_COLOR = '#00FFFF';

    let _sstVisible = true;

    const data = {
      datasets: [{
        data: this.fillMissingDays({}),
        backgroundColor: (c) => {
          if (c.dataset.data.length) {
            const value = _sstVisible ? c.dataset.data[c.dataIndex]?.temp : c.dataset.data[c.dataIndex]?.anomaly;
            switch (true) {
              case (value === this.MISSING_DATA_VALUE):
                return 'transparent';
              case Number.isNaN(value):
                return NO_DATA_COLOR;
              default:
                return this.getColorFromValue(value).toCss(true);
            }
          }
        },
        borderColor: (c) => {
          if (c.dataset.data.length) {
            const data = c.dataset.data[c.dataIndex];

            switch (true) {
              case (data.diff === 0):
                return CURRENT_DAY_COLOR;
              case (data.temp === this.MISSING_DATA_VALUE):
                return '#293657';
              case Number.isNaN(data.temp):
                return 'transparent';
              // case (data.anomaly >= this.MIN_ANOMALY):
              //   return HOTSPOT_COLOR;
              default:
                return 'transparent';
            }
          }
        },
        borderWidth: 1.0,
        hoverBorderWidth: 1.5,
        //hoverBorderColor: BORDER_COLOR,
        width(c) {
          const { left, right } = c.chart.chartArea || { left: 0, right: 100 };
          return ((right - left) / 53) - 1;
        },
        height(c) {
          const { top, bottom } = c.chart.chartArea || { top: 0, bottom: 100 };
          return ((bottom - top) / 7) - 1;
        }
      }]
    };

    const scales = {
      y: {
        type: 'time',
        offset: true,
        time: {
          unit: 'day',
          round: 'day',
          isoWeekday: 1,
          parser: 'i',
          displayFormats: {
            day: 'iiiiii'
          }
        },
        reverse: true,
        //position: 'right',
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          padding: 5,
          font: { size: 9 }
        },
        grid: {
          display: false,
          drawBorder: false,
          tickLength: 0
        }
      },
      x: {
        type: 'time',
        position: 'bottom',
        offset: true,
        time: {
          unit: 'week',
          round: 'week',
          isoWeekday: 1,
          displayFormats: {
            week: 'MMM dd'
          }
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          font: {
            size: 9
          }
        },
        grid: {
          display: false,
          drawBorder: false,
          tickLength: 0
        }
      }
    };

    const options = {
      animations: true,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: false,
        title: {
          display: true,
          font: { size: 14, weight: 'normal' },
          text: 'Daily Temperatures for Year'
        },
        tooltip: {
          displayColors: false,
          caretPadding: 8,
          backgroundColor: '#1C243B',
          borderColor: '#C77A41',
          borderWidth: 1,
          titleFont: { size: 17 },
          bodyFont: { size: 15 },
          filter: (item) => {
            const data = item.dataset.data[item.dataIndex];
            return (data.temp !== this.MISSING_DATA_VALUE);
          },
          callbacks: {
            title: (items) => {
              if (items?.length) {
                const item = items.at(0);
                const data = item.dataset.data[item.dataIndex];
                if (_sstVisible) {
                  return (data.temp !== this.MISSING_DATA_VALUE) ? 'Temperature' : null;
                } else {
                  return (data.anomaly !== this.MISSING_DATA_VALUE) ? 'Anomaly' : null;
                }
              } else {
                return null;
              }
            },
            label: (item) => {
              const data = item.dataset.data[item.dataIndex];
              const value = _sstVisible ? data.temp : data.anomaly;
              if (value !== this.MISSING_DATA_VALUE) {

                const labels = [`Date: ${data.label}`];
                if (_sstVisible) {
                  labels.push(Number.isNaN(value) ? 'Temp: No Data' : `Temp: ${value.toFixed(1)}° C`);
                } else {
                  labels.push(Number.isNaN(value) ? 'Anomaly: No Data' : `Anomaly: ${value.toFixed(1)}° C`);
                }

                return labels;
              } else {
                return null;
              }
            }
          }
        }
      },
      scales: scales,
      layout: { padding: { top: 5, left: 15, bottom: 5, right: 15 } },
      onClick: (evt, elements) => {
        const data = elements.at(0)?.element.$context.raw;
        data && this.dispatchEvent(new CustomEvent('day-change', ({ detail: { day: data.date } })));
      }
    };

    const chartContainer = document.getElementById('daily-chart-container');
    const chart = new Chart(chartContainer, { type: 'matrix', data: data, options: options });

    let _dataAtLocation = null;
    this.updateDailyTempChart = ({ dataAtLocation }) => {
      if (dataAtLocation) {
        //console.info(dataAtLocation);

        const year = dataAtLocation.at(0).date.getUTCFullYear();

        chart.options.plugins.title.text = _sstVisible
          ? `Daily Temperatures for ${year}`
          : `Daily Anomalies for ${year}`;

        chart.data.datasets[0].data = (dataAtLocation || this.fillMissingDays({}));
        chart.update();
      }
      _dataAtLocation = dataAtLocation;
    };

    this.addEventListener('visible-layer-change', ({ detail: { sstVisible } }) => {
      _sstVisible = sstVisible;
      this.updateDailyTempChart({ dataAtLocation: _dataAtLocation });
    });

  }

  /**
   *
   * https://github.com/Makanz/chartjs-plugin-trendline/tree/main
   *
   * @param view
   * @return {Promise<void>}
   */
  async initializeYearlyTempChart({ view }) {

    const varianceLabel = document.getElementById('variance-label');
    const degreesFormatter = new Intl.NumberFormat('default', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const LINE_COLOR = '#C77A41';
    const BORDER_COLOR = '#efefef';
    const CURRENT_DAY_COLOR = '#00FFFF';

    let _sstVisible = true;

    const calculateRank = (value, context) => {
      const sorted = [...context.dataset.data].map(d => _sstVisible ? d.temp : d.anomaly).filter(v => !Number.isNaN(v)).sort((v1, v2) => v2 - v1);
      let rank = (sorted.indexOf(value) + 1);
      switch (rank) {
        case 1:
          rank = `${rank}st`; // ˢᵗ
          break;
        case 2:
          rank = `${rank}nd`; // ⁿᵈ
          break;
        case 3:
          rank = `${rank}rd`; // ʳᵈ
          break;
        default:
          rank = `${rank}th`; // ᵗʰ
      }

      return { rank, count: sorted.length };
    };

    const data = {
      datasets: [
        {
          data: [],
          label: 'data by year',
          cubicInterpolationMode: 'monotone',
          parsing: { xAxisKey: 'year', yAxisKey: 'temp' },
          borderColor: LINE_COLOR,
          pointRadius: 4.5,
          pointHoverRadius: 5.5,
          pointBorderWidth: 1.5,
          pointBackgroundColor: (c) => {
            if (c.dataset.data.length) {
              const data = c.dataset.data[c.dataIndex];
              if (Number(data.year) === this.settings.currentYear) {
                return CURRENT_DAY_COLOR;
              } else {
                return 'transparent';
              }
            }
          },
          // pointHoverBackgroundColor: '#efefef',
          pointBorderColor: (c) => {
            if (c.dataset.data.length) {
              const data = c.dataset.data[c.dataIndex];
              switch (true) {
                // case (Number(data.year) === this.settings.currentYear):
                //   return CURRENT_DAY_COLOR;
                // case (data.anomaly >= this.MIN_ANOMALY):
                //   return HOTSPOT_COLOR;
                case Number.isNaN(data.temp):
                  return 'transparent';
                default:
                  return BORDER_COLOR;
              }

            }
          },
          trendlineLinear: {
            colorMin: '#efefef',
            colorMax: '#efefef',
            lineStyle: "dotted",  // dotted|solid|line
            width: 2,
            xAxisKey: 'year',
            yAxisKey: 'temp',
            projection: false
          },
          segment: {
            borderColor: (context) => {
              const startValue = _sstVisible ? context.p0.raw.temp : context.p0.raw.anomaly;
              const endValue = _sstVisible ? context.p1.raw.temp : context.p1.raw.anomaly;
              const midValue = startValue + ((endValue - startValue) * 0.5);
              const startClr = this.getColorFromValue(startValue);
              const midClr = this.getColorFromValue(midValue);
              const endClr = this.getColorFromValue(endValue);
              const gradient = chart.ctx.createLinearGradient(0, context.p0.y, 0, context.p1.y);
              gradient.addColorStop(0, startClr.toCss(true));
              gradient.addColorStop(0.5, midClr.toCss(true));
              gradient.addColorStop(1, endClr.toCss(true));
              return gradient;
            }
          }
        }
      ]
    };

    const scales = {
      x: {
        type: 'time',
        title: {
          display: false,
          text: 'Year'
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          font: { size: 10 }
        },
        grid: {
          display: false
        }
      },
      y: {
        bounds: 'data',
        title: {
          display: true,
          text: 'temp °C'
        },
        ticks: {
          callback: function (value, index, ticks) {
            return `${value.toFixed(1)}°`;
          }
        },
        grid: {
          color: '#666666'
        },
        afterDataLimits(scale) {
          const { min, max } = scale;
          const range = (max - min);
          varianceLabel.innerText = `${_sstVisible ? 'Temperature' : 'Anomaly'} Range: ${degreesFormatter.format(range)}° C ( ${degreesFormatter.format(min)}° C to ${degreesFormatter.format(max)}° C )`;
        }
      }
    };

    const options = {
      animations: true,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: false,
        title: {
          display: true,
          font: { size: 14, weight: 'normal' },
          text: 'Yearly Temperatures for Day'
        },
        tooltip: {
          displayColors: false,
          caretPadding: 10,
          mode: 'nearest',
          axis: 'x',
          intersect: false,
          position: 'nearest',
          backgroundColor: '#1C243B',
          borderColor: '#C77A41',
          borderWidth: 1,
          titleFont: { size: 17 },
          bodyFont: { size: 15 },
          callbacks: {
            title: (items) => {
              if (items?.length) {
                const item = items.at(0);
                const data = item.dataset.data[item.dataIndex];
                if (_sstVisible) {
                  return (data.temp !== this.MISSING_DATA_VALUE) ? 'Temperature' : null;
                } else {
                  return (data.anomaly !== this.MISSING_DATA_VALUE) ? 'Anomaly' : null;
                }
              } else {
                return null;
              }
            },
            label: (context) => {

              const data = context.dataset.data[context.dataIndex];
              const value = _sstVisible ? data.temp : data.anomaly;
              if (value !== this.MISSING_DATA_VALUE) {

                const labels = [`Date: ${data.label}`];
                if (_sstVisible) {
                  labels.push(Number.isNaN(value) ? 'Temp: No Data' : `Temp: ${value.toFixed(1)}° C`);
                } else {
                  labels.push(Number.isNaN(value) ? 'Anomaly: No Data' : `Anomaly: ${value.toFixed(1)}° C`);
                }
                const { rank, count } = calculateRank(value, context);
                labels.push(`Rank: ${rank} of ${count}`);

                return labels;
              } else {
                return null;
              }
            }
          }
        }
      },
      scales: scales,
      layout: { padding: { top: 5, left: 15, bottom: 5, right: 15 } },
      onClick: (evt, elements) => {
        const data = elements?.at(0)?.element.$context.raw;
        data && this.dispatchEvent(new CustomEvent('year-change', ({ detail: { year: data.year } })));
      }
    };

    const chartContainer = document.getElementById('yearly-chart-container');
    const chart = new Chart(chartContainer, { type: 'line', data: data, options: options });

    let _dataAtLocation = null;
    this.updateYearlyTempChart = ({ dataAtLocation }) => {
      if (dataAtLocation) {

        const hasValidValues = dataAtLocation.every(d => d && Number.isFinite(d[_sstVisible ? 'temp' : 'anomaly']));
        if (!hasValidValues) {

          console.info("Has Invalid Values: ");
          console.table(dataAtLocation.map(d => {
            const { temp, anomaly } = d;
            return { temp, anomaly };
          }));

        } else {

          const day = this.dayFormatter.format(dataAtLocation.at(0).date);

          chart.options.plugins.title.text = _sstVisible
            ? `Yearly Temperatures for ${day}`
            : `Yearly Anomalies for ${day}`;

          chart.data.datasets[0].data = (dataAtLocation || this.fillMissingDays({}));
          chart.data.datasets[0].parsing.yAxisKey = _sstVisible ? 'temp' : 'anomaly';
          chart.data.datasets[0].trendlineLinear.yAxisKey = _sstVisible ? 'temp' : 'anomaly';
          chart.options.scales.y.title.text = _sstVisible ? 'temp °C' : 'anomaly °C';
          chart.update();
        }
        _dataAtLocation = dataAtLocation;

      }
    };

    this.addEventListener('visible-layer-change', ({ detail: { sstVisible } }) => {
      _sstVisible = sstVisible;
      this.updateYearlyTempChart({ dataAtLocation: _dataAtLocation });
    });

  }

  /**
   *
   * @param view
   * @return {Promise<void>}
   */
  async initializeTemperatureProfile({ view }) {

    const profileLineSymbol = {
      type: "line-3d",
      symbolLayers: [
        {
          type: "line",
          size: 3.0,
          material: { color: "rgba(239,239,239,0.5)" },
          pattern: { type: "style", style: "solid" },
          marker: {
            type: "style",
            style: "cross",
            placement: "begin-end",
            color: "#efefef"
          }
        },
        {
          type: "line",
          size: 1.8,
          material: { color: "#C77A41" },
          pattern: { type: "style", style: "dash" }
        }
      ]
    };

    const GraphicsLayer = await $arcgis.import("esri/layers/GraphicsLayer");
    const sketchLayer = new GraphicsLayer({
      title: 'sketch',
      elevationInfo: { mode: "on-the-ground" }
    });

    const Graphic = await $arcgis.import("esri/Graphic");
    const profileLocationGraphic = new Graphic({
      symbol: {
        type: "point-3d",
        symbolLayers: [
          {
            type: "icon",
            size: 13,
            resource: { primitive: "circle" },
            material: { color: "#C77A41" },
            outline: { color: 'rgba(239,239,239,0.8)', size: 2.2 }
          }
        ]
      }
    });
    const profileLocationLayer = new GraphicsLayer({
      title: 'Profile Location',
      elevationInfo: { mode: "on-the-ground" },
      graphics: [profileLocationGraphic]
    });
    view.map.addMany([sketchLayer, profileLocationLayer]);

    const sketchProfileAction = document.getElementById('sketch-profile-action');

    let isActive = false;
    const _toggleSketchTool = (enable) => {
      isActive = sketchProfileAction.toggleAttribute('active', enable);
      sketchProfileAction.toggleAttribute('indicator', isActive);
      this.dispatchEvent(new CustomEvent('profile-sketch-active', { detail: { sketchActive: isActive } }));
    };

    const _clearProfileResults = () => {
      _currentProfileLine = null;
      sketchVM.cancel();
      profileLocationGraphic.geometry = null;
      sketchLayer.removeAll();
      this.updateProfileChart({ profileData: [] });
    };

    const bottomBlock = document.querySelector('calcite-block[slot="panel-bottom"]');
    bottomBlock.toggleAttribute('hidden', false);
    bottomBlock.addEventListener('calciteBlockOpen', evt => {
      sketchProfileAction.toggleAttribute('disabled', false);
      _clearProfileResults();
    });
    bottomBlock.addEventListener('calciteBlockClose', evt => {
      sketchProfileAction.toggleAttribute('disabled', true);
      _toggleSketchTool(false);
      _clearProfileResults();
    });

    const defaultProfileMessage = bottomBlock.getAttribute('description');
    const _updateProfileMessage = text => {
      bottomBlock.setAttribute('description', text || defaultProfileMessage);
    };

    const SketchViewModel = await $arcgis.import("esri/widgets/Sketch/SketchViewModel");
    const sketchVM = new SketchViewModel({
      layer: sketchLayer,
      view: view,
      polylineSymbol: profileLineSymbol,
      defaultCreateOptions: { hasZ: false }
    });

    sketchProfileAction.addEventListener('click', (event) => {
      _toggleSketchTool(!sketchProfileAction.hasAttribute('active'));
      _clearProfileResults();

      if (isActive) {
        sketchVM.create('polyline');
      } else {
        sketchVM.cancel();
      }
    });

    reactiveUtils.on(() => sketchVM, 'create', (event) => {
      if (event.toolEventInfo?.type === "vertex-add") {
        if (event.graphic.geometry.paths.at(0).length > 1) {
          sketchVM.complete();
          this.updateTemperatureProfile({ profileLine: event.graphic.geometry });
          _toggleSketchTool(false);
        }
      }
    });

    let _currentProfileLine = null;
    this.updateTemperatureProfile = ({ profileLine }) => {
      _currentProfileLine = profileLine || _currentProfileLine;
      if (_currentProfileLine) {
        sketchProfileAction.toggleAttribute('loading', true);
        _updateProfileMessage("...calculating new temperature data profile...");
        this.updateProfileChart({ profileData: [] });
        this.getDataProfile({ profileLine: _currentProfileLine }).then(({ dataAtLocation }) => {
          this.updateProfileChart({ profileData: dataAtLocation });
          _updateProfileMessage();
          sketchProfileAction.toggleAttribute('loading', false);
        });
      }
    };

    const kmFormatter = new Intl.NumberFormat('default', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const data = {
      datasets: [
        {
          data: [],
          cubicInterpolationMode: 'monotone',
          parsing: { xAxisKey: 'distance', yAxisKey: 'temp' },
          borderColor: '#C77A41',
          borderWidth: 2.2,
          pointRadius: 0.0,
          pointHoverRadius: 5.5,
          pointHoverBorderColor: '#C77A41',
          segment: {
            borderColor: (context) => {
              const startValue = context.p0.raw.temp;
              const endValue = context.p1.raw.temp;
              const midValue = startValue + ((endValue - startValue) * 0.5);
              const startClr = this.getColorFromValue(startValue);
              const midClr = this.getColorFromValue(midValue);
              const endClr = this.getColorFromValue(endValue);
              const gradient = chart.ctx.createLinearGradient(0, context.p0.y, 0, context.p1.y);
              gradient.addColorStop(0, startClr.toCss(true));
              gradient.addColorStop(0.5, midClr.toCss(true));
              gradient.addColorStop(1, endClr.toCss(true));
              return gradient;
            }
          }
        }
      ]
    };

    const scales = {
      x: {
        type: 'linear',
        bounds: 'data',
        suggestedMin: 0,
        suggestedMax: 100,
        title: {
          display: false
        },
        ticks: {
          display: true,
          callback: function (value, index, ticks) {
            return ` ${kmFormatter.format(value)} kms`;
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        type: 'linear',
        bounds: 'data',
        title: {
          display: true,
          text: 'temp °C'
        },
        ticks: {
          callback: function (value, index, ticks) {
            return `${value.toFixed(1)}°`;
          }
        },
        grid: {
          color: '#666666'
        }
      }
    };

    const options = {
      animations: true,
      responsive: true,
      maintainAspectRatio: false,
      onHover: (evt) => {
        if ((evt.type === "mousemove") && chart.data.datasets[0].data.length) {
          const [nearestElem] = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
          if (nearestElem) {
            const data = nearestElem.element.raw;
            profileLocationGraphic.geometry = { type: 'point', x: data.lon, y: data.lat };
          } else {
            profileLocationGraphic.geometry = null;
          }
        } else {
          profileLocationGraphic.geometry = null;
        }
      },
      plugins: {
        legend: false,
        title: {
          display: false
        },
        tooltip: {
          displayColors: false,
          caretPadding: 10,
          mode: 'nearest',
          axis: 'x',
          intersect: false,
          position: 'nearest',
          backgroundColor: '#1C243B',
          borderColor: '#C77A41',
          borderWidth: 1,
          titleFont: { size: 17 },
          bodyFont: { size: 15 },
          callbacks: {
            title: (items) => {
              if (items?.length) {
                const item = items.at(0);
                const data = item.dataset.data[item.dataIndex];
                return (data.temp !== this.MISSING_DATA_VALUE) ? 'Temperature' : null;
              } else {
                return null;
              }
            },
            label: (context) => {

              const data = context.dataset.data[context.dataIndex];
              const value = data.temp;
              if (value !== this.MISSING_DATA_VALUE) {

                const labels = [`Date: ${data.label}`];
                labels.push(Number.isNaN(value) ? 'Temp: No Data' : `Temp: ${value.toFixed(1)}° C`);

                return labels;
              } else {
                return null;
              }
            }
          }
        }
      },
      scales: scales
    };

    const chartContainer = document.getElementById('profile-chart-container');
    const chart = new Chart(chartContainer, { type: 'line', data: data, options: options });
    //chart.update();

    this.updateProfileChart = ({ profileData }) => {
      if (profileData) {
        chart.data.datasets[0].data = profileData;
        chart.update();
      }
    };

  }

}

export default new Application();
