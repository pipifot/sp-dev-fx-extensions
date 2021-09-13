import * as React from 'react';
import styles from './components.module.scss';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { SpinnerSize } from '@fluentui/react/lib/Spinner';
import { FC, useState, useEffect } from 'react';
import CommandHelper from '../Helpers/CommandHelper';
import { ICommandHelper } from '../Helpers/ICommandHelper';
import { IFieldInfo, IMappingFieldInfo, IMessageInfo, LoaderType, MessageScope } from '../Models/IModel';
import ContentLoader from './ContentLoader';
import { css } from '@fluentui/utilities';
import { Separator } from '@fluentui/react/lib/Separator';
import { Icon, IIconStyles } from '@fluentui/react/lib/Icon';
import MessageContainer from './Message';
import { Checkbox, PrimaryButton } from '@fluentui/react';
import { find, uniqBy } from 'lodash';

interface IFieldMapperProps {
    sourceListID: string;
    destListID: string;
    confirmFieldMapping: (mappedFields: IMappingFieldInfo[]) => void;
    showOrHideActions: (show: boolean) => void;
    disableAll: boolean;
}

const iconStyles: IIconStyles = {
    root: {
        fontSize: '24px',
        height: '24px',
        width: '24px',
    },
};

const FieldMapper: FC<IFieldMapperProps> = (props) => {
    const _helper: ICommandHelper = new CommandHelper();
    const [loading, setLoading] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [disConfirmFM, setDisConfirmFM] = useState<boolean>(false);
    const [sourceFields, setSourceFields] = useState<IDropdownOption[]>(undefined);
    const [destFields, setDestFields] = useState<IDropdownOption[]>([]);
    const [mappedFields, setMappedFields] = useState<IMappingFieldInfo[]>([]);
    const [fmMessage, setFMMessage] = useState<IMessageInfo>(undefined);

    const _loadListFields = async () => {
        setFMMessage(undefined);
        setDisabled(false);
        setLoading(true);
        let listFields = await _helper.getListFields(props.destListID.toString());
        console.log("Destination Fields: ", listFields);
        let ddlDestOptions: IDropdownOption[] = [];
        listFields.map(destField => {
            ddlDestOptions.push({ key: destField.InternalName, text: destField.Title, data: destField });
        });
        setDestFields(ddlDestOptions);

        listFields = await _helper.getListFields(props.sourceListID.toString());
        listFields = listFields.filter(f => f.TypeAsString.toLowerCase() === "text" || f.TypeAsString.toLowerCase() === "choice"
            || f.TypeAsString.toLowerCase() === "datetime" || f.TypeAsString.toLowerCase() === "boolean"
            || f.TypeAsString.toLowerCase() === "number");
        console.log("Source list fields: ", listFields);
        let ddlOptions: IDropdownOption[] = [];
        let _mappedFields: IMappingFieldInfo[] = [];
        listFields.map(srcField => {
            let dFields = ddlDestOptions.filter(f => f.data.TypeAsString === srcField.TypeAsString);
            let dtMapField = find(ddlDestOptions, (f) => f.key.toString().toLowerCase() === srcField.InternalName.toLowerCase());
            ddlOptions.push({ key: srcField.InternalName, text: srcField.Title, data: srcField });
            if (dtMapField) {
                _mappedFields.push({
                    Enabled: dFields.length > 0,
                    SFId: srcField.Id.toString(),
                    SFDisplayName: srcField.Title,
                    SFInternalName: srcField.InternalName,
                    SFType: srcField.TypeDisplayName,
                    SFTypeName: srcField.TypeAsString,
                    DFId: dtMapField.data.Id.toString(),
                    DFDisplayName: dtMapField.text,
                    DFInternalName: dtMapField.data.InternalName,
                    DFType: dtMapField.data.TypeDisplayName,
                    DFTypeName: dtMapField.data.TypeAsString
                });
            } else {
                _mappedFields.push({
                    Enabled: dFields.length > 0,
                    SFId: srcField.Id.toString(),
                    SFDisplayName: srcField.Title,
                    SFInternalName: srcField.InternalName,
                    SFType: srcField.TypeDisplayName,
                    SFTypeName: srcField.TypeAsString
                });
            }
        });
        setSourceFields(ddlOptions);
        setMappedFields(_mappedFields);
        if (_mappedFields.filter(f => f.Enabled).length <= 0) {
            setFMMessage({ msg: "Destination fields doesn't match. Please select a different list!", scope: MessageScope.Warning });
            setDisabled(true);
        }
        setLoading(false);
    };

    const _handleOnCheckboxChange = (srcField: IFieldInfo, ischecked: boolean) => {
        setFMMessage(undefined);
        props.showOrHideActions(false);
        setDisConfirmFM(false);
        if (mappedFields) {
            let _mapfields = mappedFields;
            let fil = _mapfields.filter(f => f.SFId === srcField.Id.toString());
            if (fil && fil.length > 0) {
                if (ischecked) fil[0].Enabled = true;
                else fil[0].Enabled = false;
            }
            setMappedFields(_mapfields);
        }
    };

    const _handleOnFieldDropdownChange = (srcFieldId: string, option: IDropdownOption<any>) => {
        setFMMessage(undefined);
        props.showOrHideActions(false);
        setDisConfirmFM(false);
        if (option.key && option.key.toString() !== "0") {
            if (mappedFields) {
                let _mapfields = mappedFields;
                if (_mapfields.filter(f => f.DFId === option.data.Id).length > 0) {
                    setFMMessage({ msg: "Field already mapped!", scope: MessageScope.Warning });
                }
                let fil = _mapfields.filter(f => f.SFId === srcFieldId.toString());
                if (fil && fil.length > 0) {
                    fil[0].DFId = option.data.Id.toString();
                    fil[0].DFDisplayName = option.text;
                    fil[0].DFInternalName = option.data.InternalName;
                    fil[0].DFType = option.data.TypeDisplayName;
                    fil[0].DFTypeName = option.data.TypeAsString;
                }
                setMappedFields(_mapfields);
            }
        }
    };

    const _confirmFieldMapping = () => {
        console.log("Confirmed Field mapping", mappedFields);
        let enabFields = mappedFields.filter(f => f.Enabled);
        if (enabFields.length > 0) {
            let inCompleteMF = enabFields.filter(f => f.DFInternalName == undefined || f.DFInternalName == "");
            if (inCompleteMF.length > 0) {
                setFMMessage({ msg: "Please select the mapping field for the selected source field!", scope: MessageScope.Failure });
                props.confirmFieldMapping([]);
            } else {
                let duplicates = uniqBy(enabFields, 'DFId').length !== enabFields.length;
                if (!duplicates) {
                    setDisConfirmFM(true);
                    props.confirmFieldMapping(enabFields);
                }
                else setFMMessage({ msg: "Multiple mappings found for the same field!", scope: MessageScope.Failure });
            }
        } else {
            setFMMessage({ msg: "Atleast one field should be mapped!", scope: MessageScope.Warning });
            props.confirmFieldMapping([]);
        }
    };

    useEffect(() => {
        setDisabled(props.disableAll);
    }, [props.disableAll]);

    useEffect(() => {
        if (props.sourceListID && props.destListID) _loadListFields();
    }, [props.sourceListID, props.destListID]);

    return (
        <div className={styles.fieldMapping}>
            {loading ? (
                <ContentLoader loaderType={LoaderType.Spinner} loaderMsg={"Loading fields..."} spinSize={SpinnerSize.small} />
            ) : (
                <>
                    {sourceFields && destFields ? (
                        <>
                            <div className={styles.fieldContainer}>
                                <div style={{ marginTop: '7px' }} />
                                <div className={css(styles.srcFieldContainer)}>
                                    <b>Source Field(s)</b>
                                </div>
                                <Separator className={css(styles.fieldSeparator, styles.fieldSeparatorHeader)}><Icon iconName={"DoubleChevronRight8"} styles={iconStyles} /></Separator>
                                <div className={css(styles.destFieldContainer, styles.destFieldContainerHeader)}>
                                    <b>Destination Field(s)</b>
                                </div>
                            </div>
                            {sourceFields.map(srcField => {
                                let dFields = destFields.filter(f => f.data.TypeAsString === srcField.data.TypeAsString);
                                let mapField = find(mappedFields, (f) => f.SFId === srcField.data.Id.toString());
                                return (
                                    <div className={styles.fieldContainer}>
                                        <div style={{ marginTop: '7px' }}>
                                            <Checkbox onChange={(ev, ischecked: boolean) => { _handleOnCheckboxChange(srcField.data, ischecked); }}
                                                defaultChecked={dFields.length > 0 ? true : false} disabled={dFields.length <= 0 || disabled} />
                                        </div>
                                        <div className={css(styles.srcFieldContainer)}>
                                            <b>{srcField.text}</b> ({srcField.data ? srcField.data.TypeDisplayName : ''})
                                        </div>
                                        <Separator className={styles.fieldSeparator}><Icon iconName={"DoubleChevronRight8"} styles={iconStyles} /></Separator>
                                        <div className={css(styles.destFieldContainer)}>
                                            <Dropdown placeholder="Map the field" options={dFields} selectedKey={mapField ? mapField.DFInternalName : undefined}
                                                className={styles.fieldDDL} disabled={dFields.length <= 0 || disabled}
                                                onChange={(ev, option: IDropdownOption<any>) => { _handleOnFieldDropdownChange(srcField.data.Id, option); }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className={styles.footerMargins}>
                                {fmMessage &&
                                    <MessageContainer MessageScope={fmMessage.scope} Message={fmMessage.msg} />
                                }
                                <div className={styles.btnConfirmMapping}>
                                    <PrimaryButton onClick={_confirmFieldMapping} text="Confirm the mapping?" disabled={disabled || disConfirmFM} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <MessageContainer MessageScope={MessageScope.Info} Message="Please select a destination list!" />
                    )}
                </>
            )}
        </div>
    );
};

export default FieldMapper;